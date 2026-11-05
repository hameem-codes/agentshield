"""
Security Hardening Tests for AgentShield.

Covers:
1. Agent credential security (salted PBKDF2 hashing, verification, key rotation).
2. Advanced sensitive-data redaction (free text, cloud tokens, nested structures, immutability, negative tests).
3. Review queue expiry (timestamps, explicit expired state, double-approval & replay prevention).
4. Cryptographic hash chain audit integrity (genesis hash, chain verification, tampering detection, concurrency).
"""

import copy
import json
import sqlite3
import tempfile
import threading
import time
import pytest

from agentshield import Shield, ExecutionStatus
from agentshield.models import Decision, DecisionValue, RiskLevel
from agentshield.audit import SQLiteAuditStore, redact_sensitive_data, GENESIS_HASH
from agentshield.shield import ReviewStatus

# ---------------------------------------------------------------------------
# 1. Agent Credential Security Tests
# ---------------------------------------------------------------------------

def test_agent_credentials_salted_pbkdf2_and_rotation():
    store = SQLiteAuditStore(db_path=":memory:")
    shield = Shield(audit_store=store, agent_keys={"bot_alpha": "alpha-secret-key-12345"})
    shield.registry.register("create_order", lambda args: {"status": "ok"})

    from agentshield.policy.rules import PolicyConfiguration, AgentConfig, ToolRule
    shield.policy_engine.config = PolicyConfiguration(
        agents={"bot_alpha": AgentConfig(name="bot_alpha", allowed_tools=["create_order"])},
        tools={"create_order": ToolRule(tool="create_order", max_quantity=10)}
    )

    # Raw key must NOT be stored anywhere
    assert "alpha-secret-key-12345" not in shield.agent_keys.values()
    assert "bot_alpha" in shield._agent_salts
    assert len(shield._agent_salts["bot_alpha"]) == 16  # 16-byte random salt
    assert len(shield.agent_keys["bot_alpha"]) == 64   # 64-char hex digest

    # Valid key -> ALLOW
    dec_valid = shield.authorize(agent="bot_alpha", tool="create_order", arguments={"product": "book"}, agent_key="alpha-secret-key-12345")
    assert dec_valid.allowed is True
    assert dec_valid.decision == DecisionValue.ALLOW

    # Invalid key -> BLOCK
    dec_invalid = shield.authorize(agent="bot_alpha", tool="create_order", arguments={"product": "book"}, agent_key="wrong-key")
    assert dec_invalid.allowed is False
    assert dec_invalid.decision == DecisionValue.BLOCK
    assert any("Authentication failed" in r for r in dec_invalid.reasons)

    # Missing key -> BLOCK
    dec_missing = shield.authorize(agent="bot_alpha", tool="create_order", arguments={"product": "book"}, agent_key=None)
    assert dec_missing.allowed is False
    assert dec_missing.decision == DecisionValue.BLOCK

    # Key rotation: rotate to new key with retire_old=True (immediate invalidation)
    shield.rotate_agent_key("bot_alpha", "alpha-new-key-67890", retire_old=True)
    assert shield.agent_keys["bot_alpha"] != "alpha-new-key-67890"

    # Old key is now rejected
    dec_old = shield.authorize(agent="bot_alpha", tool="create_order", arguments={"product": "book"}, agent_key="alpha-secret-key-12345")
    assert dec_old.allowed is False
    assert dec_old.decision == DecisionValue.BLOCK

    # New key is accepted
    dec_new = shield.authorize(agent="bot_alpha", tool="create_order", arguments={"product": "book"}, agent_key="alpha-new-key-67890")
    assert dec_new.allowed is True

    # Key rotation with grace period (retire_old=False)
    shield.rotate_agent_key("bot_alpha", "alpha-v3-key-11111", retire_old=False)
    # Both v3 and new-key-67890 are accepted during transition
    dec_v3 = shield.authorize(agent="bot_alpha", tool="create_order", arguments={"product": "book"}, agent_key="alpha-v3-key-11111")
    assert dec_v3.allowed is True
    dec_prev = shield.authorize(agent="bot_alpha", tool="create_order", arguments={"product": "book"}, agent_key="alpha-new-key-67890")
    assert dec_prev.allowed is True

# ---------------------------------------------------------------------------
# 2. Sensitive-Data Redaction Tests
# ---------------------------------------------------------------------------

def test_redact_free_text_api_keys_and_tokens():
    # OpenAI sk- style tokens in free text
    raw_args = {
        "text": "my key is sk-test1234567890",
        "nested": {
            "prompt": "Use sk-live-abc1234567890def for authentication.",
            "note": "Authorization: Bearer my-secret-bearer-token-12345",
        },
        "config": "server password=supersecretpass123; host=db.internal",
        "cloud": {
            "aws": "credentials: AKIAIOSFODNN7EXAMPLE",
            "github": "deploy with ghp_0123456789abcdefghijklmnopqrstuvwxyz",
            "slack": "bot token is xoxb-123456789012-abcdef123456",
        }
    }

    original = copy.deepcopy(raw_args)
    redacted = redact_sensitive_data(raw_args)

    # Input object must NOT be mutated
    assert raw_args == original

    # Free text API key redacted
    assert redacted["text"] == "my key is [REDACTED]"
    assert "sk-test" not in json.dumps(redacted)

    # Nested text redacted
    assert "[REDACTED]" in redacted["nested"]["prompt"]
    assert "sk-live" not in json.dumps(redacted)
    assert "[REDACTED]" in redacted["nested"]["note"]

    # Inline password redacted
    assert "password=[REDACTED]" in redacted["config"]
    assert "supersecretpass123" not in json.dumps(redacted)

    # Cloud tokens redacted
    assert "[REDACTED]" in redacted["cloud"]["aws"]
    assert "AKIAIOSFODNN7EXAMPLE" not in json.dumps(redacted)
    assert "[REDACTED]" in redacted["cloud"]["github"]
    assert "ghp_0123456789" not in json.dumps(redacted)
    assert "[REDACTED]" in redacted["cloud"]["slack"]
    assert "xoxb-" not in json.dumps(redacted)

def test_redact_private_key_blocks():
    pem_key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAz8...\n-----END RSA PRIVATE KEY-----"
    raw_args = {"cert": "valid", "private_key_block": pem_key}
    redacted = redact_sensitive_data(raw_args)
    assert "[REDACTED" in redacted["private_key_block"]
    assert "MIIEowIBAAKCAQEAz8" not in json.dumps(redacted)

def test_redact_negative_tests_no_false_positives():
    """Ensure normal English and operational text are not falsely redacted."""
    safe_args = {
        "description": "I use keyboard shortcuts for productivity.",
        "search_term": "keyword analysis",
        "author": "Alice Smith",
        "authority_name": "Regional Health Authority",
        "network": "token ring network protocol",
        "connection_status": "authentication completed normally",
        "api_url": "https://api.example.com/v1/products?limit=10",
        "normal_count": 42,
        "is_active": True,
    }
    redacted = redact_sensitive_data(safe_args)
    assert redacted == safe_args

def test_audit_store_persists_only_redacted_data():
    store = SQLiteAuditStore(db_path=":memory:")
    dec = Decision(
        allowed=True,
        decision=DecisionValue.ALLOW,
        reasons=["ok"],
        risk_score=0.0,
        severity=RiskLevel.LOW,
        agent="agent1",
        tool="tool1"
    )
    unredacted_secret = "sk-test999998888877777"
    store.log_decision(dec, arguments={"note": f"my key is {unredacted_secret}"})

    records = store.query(agent="agent1")
    assert len(records) == 1
    assert unredacted_secret not in json.dumps(records[0].arguments)
    assert records[0].arguments["note"] == "my key is [REDACTED]"

# ---------------------------------------------------------------------------
# 3. Review Queue Expiry & State Machine Tests
# ---------------------------------------------------------------------------

def test_review_queue_lifecycle_and_expiry():
    store = SQLiteAuditStore(db_path=":memory:")
    # Short 0.05s TTL
    shield = Shield(audit_store=store, review_ttl_seconds=0.05)
    call_counts = {"refund": 0}
    shield.registry.register("refund_order", lambda args: (call_counts.__setitem__("refund", call_counts["refund"] + 1), {"done": True})[1])

    from agentshield.policy.rules import PolicyConfiguration, AgentConfig, ToolRule
    shield.policy_engine.config = PolicyConfiguration(
        agents={"lead": AgentConfig(name="lead", allowed_tools=["refund_order"])},
        tools={"refund_order": ToolRule(tool="refund_order", max_amount=100000)}
    )

    # 1. Trigger review
    dec = shield.authorize(agent="lead", tool="refund_order", arguments={"amount": 2500})
    assert dec.decision == DecisionValue.REVIEW

    queue = shield.get_review_queue()
    assert len(queue) == 1
    item = queue[0]
    rev_id = item["review_id"]
    assert item["status"] == ReviewStatus.PENDING.value
    assert item["created_at"] < item["expires_at"]
    assert shield.get_review_status(rev_id) == ReviewStatus.PENDING.value

    # 2. Wait for expiration
    time.sleep(0.06)

    # Queue should now be empty and status explicitly 'expired'
    assert len(shield.get_review_queue()) == 0
    assert shield.get_review_status(rev_id) == ReviewStatus.EXPIRED.value

    # 3. Approving expired request MUST fail closed
    exec_expired = shield.approve_review(rev_id, approver="admin_bob")
    assert exec_expired is None
    assert call_counts["refund"] == 0

    # 4. Check audit log has 'incident:expired'
    expired_events = store.query(agent="lead", tool="incident:expired")
    assert len(expired_events) == 1
    assert expired_events[0].decision == "BLOCK"

def test_review_queue_replay_and_double_approval_prevention():
    store = SQLiteAuditStore(db_path=":memory:")
    shield = Shield(audit_store=store, review_ttl_seconds=60.0)
    call_counts = {"refund": 0}
    shield.registry.register("refund_order", lambda args: (call_counts.__setitem__("refund", call_counts["refund"] + 1), {"refunded": True})[1])

    from agentshield.policy.rules import PolicyConfiguration, AgentConfig, ToolRule
    shield.policy_engine.config = PolicyConfiguration(
        agents={"lead": AgentConfig(name="lead", allowed_tools=["refund_order"])},
        tools={"refund_order": ToolRule(tool="refund_order", max_amount=100000)}
    )

    shield.authorize(agent="lead", tool="refund_order", arguments={"amount": 3000})
    rev_id = shield.get_review_queue()[0]["review_id"]

    # First approval succeeds
    res1 = shield.approve_review(rev_id, approver="alice_reviewer")
    assert res1 is not None
    assert res1.execution_status == ExecutionStatus.EXECUTED
    assert call_counts["refund"] == 1
    assert shield.get_review_status(rev_id) == ReviewStatus.APPROVED.value

    # Second approval (replay/duplicate) MUST return None and NEVER execute the callable
    res2 = shield.approve_review(rev_id, approver="bob_reviewer")
    assert res2 is None
    assert call_counts["refund"] == 1  # Callable strictly executed once

    # Rejection after approval MUST return None
    res_rej = shield.reject_review(rev_id, reviewer="charlie")
    assert res_rej is None
    assert call_counts["refund"] == 1

# ---------------------------------------------------------------------------
# 4. Cryptographic Hash Chain Audit Integrity Tests
# ---------------------------------------------------------------------------

def test_audit_hash_chain_genesis_and_valid_chain():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    try:
        store = SQLiteAuditStore(db_path=db_path)

        # Empty DB verification
        empty_check = store.verify_integrity()
        assert empty_check["valid"] is True
        assert empty_check["total_records"] == 0

        # Log 5 decisions
        for i in range(5):
            dec = Decision(
                allowed=(i % 2 == 0),
                decision=DecisionValue.ALLOW if i % 2 == 0 else DecisionValue.BLOCK,
                reasons=[f"Rule {i} evaluated"],
                risk_score=float(i * 10),
                severity=RiskLevel.LOW,
                agent="agent_chain",
                tool=f"tool_{i}"
            )
            store.log_decision(dec, arguments={"seq": i})

        # Query all records
        records = store.query(agent="agent_chain", limit=10)
        assert len(records) == 5

        # Oldest record (index 4 in desc query) must link to GENESIS_HASH
        oldest = records[-1]
        assert oldest.prev_hash == GENESIS_HASH
        assert oldest.record_hash is not None
        assert len(oldest.record_hash) == 64

        # Chain verification succeeds
        check = store.verify_integrity()
        assert check["valid"] is True
        assert check["total_records"] == 5
        assert check["error"] is None
    finally:
        import os
        if os.path.exists(db_path):
            os.remove(db_path)

def test_audit_hash_chain_detects_content_tampering():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    try:
        store = SQLiteAuditStore(db_path=db_path)
        for i in range(3):
            dec = Decision(
                allowed=False,
                decision=DecisionValue.BLOCK,
                reasons=[f"Blocked {i}"],
                risk_score=90.0,
                severity=RiskLevel.HIGH,
                agent="tamper_agent",
                tool="critical_tool"
            )
            store.log_decision(dec, arguments={"i": i})

        # Verify initial valid chain
        assert store.verify_integrity()["valid"] is True

        # Maliciously modify record 2 in the database (e.g. attacker changes BLOCK to ALLOW)
        conn = sqlite3.connect(db_path)
        with conn:
            conn.execute("UPDATE audit_logs SET decision = 'ALLOW', allowed = 1 WHERE id = 2;")
        conn.close()

        # Chain verification must immediately detect tampering
        check = store.verify_integrity()
        assert check["valid"] is False
        assert check["corrupted_record_id"] == 2
        assert "Content tampering detected" in check["error"]
    finally:
        import os
        if os.path.exists(db_path):
            os.remove(db_path)

def test_audit_hash_chain_detects_deleted_record():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    try:
        store = SQLiteAuditStore(db_path=db_path)
        for i in range(4):
            dec = Decision(
                allowed=True,
                decision=DecisionValue.ALLOW,
                reasons=["ok"],
                risk_score=0.0,
                severity=RiskLevel.LOW,
                agent="del_agent",
                tool="tool"
            )
            store.log_decision(dec, arguments={"i": i})

        assert store.verify_integrity()["valid"] is True

        # Maliciously delete record 2
        conn = sqlite3.connect(db_path)
        with conn:
            conn.execute("DELETE FROM audit_logs WHERE id = 2;")
        conn.close()

        # Record 3's prev_hash pointed to record 2, so the link is broken
        check = store.verify_integrity()
        assert check["valid"] is False
        assert check["corrupted_record_id"] == 3
        assert "Chain link broken" in check["error"]
    finally:
        import os
        if os.path.exists(db_path):
            os.remove(db_path)

def test_audit_hash_chain_concurrent_writes_integrity():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    try:
        store = SQLiteAuditStore(db_path=db_path)
        num_threads = 6
        writes_per_thread = 5

        def writer(thread_id):
            for i in range(writes_per_thread):
                dec = Decision(
                    allowed=True,
                    decision=DecisionValue.ALLOW,
                    reasons=[f"Thread {thread_id} action {i}"],
                    risk_score=0.0,
                    severity=RiskLevel.LOW,
                    agent=f"thread_{thread_id}",
                    tool="worker"
                )
                store.log_decision(dec, arguments={"t": thread_id, "i": i})

        threads = [threading.Thread(target=writer, args=(t,)) for t in range(num_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All concurrent writes must result in a contiguous, valid hash chain
        check = store.verify_integrity()
        assert check["valid"] is True
        assert check["total_records"] == num_threads * writes_per_thread
        assert check["error"] is None
    finally:
        import os
        if os.path.exists(db_path):
            os.remove(db_path)
