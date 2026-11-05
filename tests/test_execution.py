import pytest
from agentshield import Shield, ExecutionStatus
from agentshield.models import DecisionValue

def test_valid_action_execution():
    shield = Shield()
    counter = {"count": 0}
    
    def fake_create_order(arguments):
        counter["count"] += 1
        return {"status": "executed"}
        
    shield.registry.register("create_order", fake_create_order)
    
    res = shield.execute(agent="shopping_agent", tool="create_order", arguments={"product": "shoes"})
    assert res.decision.allowed is True
    assert res.decision.decision == DecisionValue.ALLOW
    assert res.execution_status == ExecutionStatus.EXECUTED
    assert counter["count"] == 1
    assert res.tool_result == {"status": "executed"}

def test_unknown_tool_no_execution():
    shield = Shield()
    counter = {"count": 0}
    
    # Tool not registered, unknown to policy
    res = shield.execute(agent="shopping_agent", tool="unknown_tool", arguments={})
    assert res.decision.allowed is False
    assert res.decision.decision == DecisionValue.BLOCK
    assert res.execution_status == ExecutionStatus.NOT_EXECUTED
    assert counter["count"] == 0
    assert res.tool_result is None

def test_malformed_action_no_execution():
    shield = Shield()
    counter = {"count": 0}
    
    def fake_create_order(arguments):
        counter["count"] += 1
        return {"status": "executed"}
        
    shield.registry.register("create_order", fake_create_order)
    
    # Missing agent makes it malformed -> BLOCK, counter 0
    res = shield.execute(agent="", tool="create_order", arguments={"product": "shoes"})
    assert res.decision.allowed is False
    assert res.decision.decision == DecisionValue.BLOCK
    assert res.execution_status == ExecutionStatus.NOT_EXECUTED
    assert counter["count"] == 0
    assert res.tool_result is None

    # Invalid arguments type -> BLOCK, counter 0
    res_args = shield.execute(agent="shopping_agent", tool="create_order", arguments=["not_a_dict"])
    assert res_args.decision.allowed is False
    assert res_args.decision.decision == DecisionValue.BLOCK
    assert res_args.execution_status == ExecutionStatus.NOT_EXECUTED
    assert counter["count"] == 0
    assert res_args.tool_result is None

def test_unauthorized_action_no_execution():
    shield = Shield()
    counter = {"count": 0}
    
    def fake_create_order(arguments):
        counter["count"] += 1
        return {"status": "executed"}
        
    shield.registry.register("create_order", fake_create_order)
    
    # evil_agent is unauthorized -> BLOCK, counter 0
    res = shield.execute(agent="evil_agent", tool="create_order", arguments={"product": "shoes"})
    assert res.decision.allowed is False
    assert res.decision.decision == DecisionValue.BLOCK
    assert res.execution_status == ExecutionStatus.NOT_EXECUTED
    assert counter["count"] == 0
    assert res.tool_result is None

def test_registered_tool_alone_does_not_grant_permission():
    shield = Shield()
    counter = {"count": 0}

    def fake_delete_db(arguments):
        counter["count"] += 1
        return {"deleted": True}

    # Registered in ToolRegistry, but NOT permitted by policy
    shield.registry.register("delete_database", fake_delete_db)
    assert shield.registry.has_tool("delete_database") is True

    res = shield.execute(agent="shopping_agent", tool="delete_database", arguments={})
    assert res.decision.allowed is False
    assert res.decision.decision == DecisionValue.BLOCK
    assert res.execution_status == ExecutionStatus.NOT_EXECUTED
    assert counter["count"] == 0
    assert res.tool_result is None

def test_policy_blocked_tool_no_execution():
    shield = Shield()
    counter = {"count": 0}

    def fake_refund(arguments):
        counter["count"] += 1
        return {"refunded": True}

    shield.registry.register("refund_order", fake_refund)

    # refund_order is explicitly denied for shopping_agent -> BLOCK, counter 0
    res = shield.execute(agent="shopping_agent", tool="refund_order", arguments={"amount": 50})
    assert res.decision.allowed is False
    assert res.decision.decision == DecisionValue.BLOCK
    assert res.execution_status == ExecutionStatus.NOT_EXECUTED
    assert counter["count"] == 0
    assert res.tool_result is None

def test_tool_execution_error_status():
    shield = Shield()

    def failing_tool(arguments):
        raise RuntimeError("Tool failed unexpectedly")

    shield.registry.register("create_order", failing_tool)

    res = shield.execute(agent="shopping_agent", tool="create_order", arguments={"product": "shoes"})
    assert res.decision.allowed is True
    assert res.decision.decision == DecisionValue.ALLOW
    assert res.execution_status == ExecutionStatus.ERROR
    assert "Tool failed unexpectedly" in (res.error or "")
    assert res.tool_result is None

def test_valid_action_executed_twice():
    shield = Shield()
    counter = {"count": 0}
    
    def fake_create_order(arguments):
        counter["count"] += 1
        return {"status": "executed"}
        
    shield.registry.register("create_order", fake_create_order)
    
    res1 = shield.execute(agent="shopping_agent", tool="create_order", arguments={"product": "shoes"})
    assert res1.execution_status == ExecutionStatus.EXECUTED
    assert counter["count"] == 1
    
    res2 = shield.execute(agent="shopping_agent", tool="create_order", arguments={"product": "shoes"})
    assert res2.execution_status == ExecutionStatus.EXECUTED
    assert counter["count"] == 2

# ---------------------------------------------------------------------------
# TOCTOU Defense: Argument Normalization and Freezing Tests
# ---------------------------------------------------------------------------

def test_nested_mutation_prevention():
    from agentshield.models import Action, FrozenDict, FrozenList

    raw_args = {
        "order": {
            "id": "ord_1",
            "items": [
                {"sku": "A1", "quantity": 2},
                {"sku": "B2", "quantity": 1}
            ]
        },
        "flags": ["urgent", "express"]
    }
    action = Action(agent="shopping_agent", tool="create_order", arguments=raw_args)

    assert isinstance(action.arguments, FrozenDict)
    assert isinstance(action.arguments["order"], FrozenDict)
    assert isinstance(action.arguments["order"]["items"], FrozenList)
    assert isinstance(action.arguments["order"]["items"][0], FrozenDict)
    assert isinstance(action.arguments["flags"], FrozenList)

    # 1. Top-level mutation fails
    with pytest.raises(TypeError, match="FrozenDict is immutable"):
        action.arguments["new_key"] = "hacked"
    with pytest.raises(TypeError, match="FrozenDict is immutable"):
        del action.arguments["flags"]
    with pytest.raises(TypeError, match="FrozenDict is immutable"):
        action.arguments.pop("flags")
    with pytest.raises(TypeError, match="FrozenDict is immutable"):
        action.arguments.clear()

    # 2. Nested dictionary mutation fails
    with pytest.raises(TypeError, match="FrozenDict is immutable"):
        action.arguments["order"]["id"] = "ord_tampered"
    with pytest.raises(TypeError, match="FrozenDict is immutable"):
        action.arguments["order"]["items"][0]["quantity"] = 99999

    # 3. Nested list mutation fails
    with pytest.raises(TypeError, match="FrozenList is immutable"):
        action.arguments["flags"].append("malicious")
    with pytest.raises(TypeError, match="FrozenList is immutable"):
        action.arguments["flags"][0] = "tampered"
    with pytest.raises(TypeError, match="FrozenList is immutable"):
        action.arguments["flags"].extend(["injected"])
    with pytest.raises(TypeError, match="FrozenList is immutable"):
        action.arguments["flags"].insert(0, "prefix")
    with pytest.raises(TypeError, match="FrozenList is immutable"):
        action.arguments["flags"].remove("urgent")
    with pytest.raises(TypeError, match="FrozenList is immutable"):
        action.arguments["flags"].pop()
    with pytest.raises(TypeError, match="FrozenList is immutable"):
        action.arguments["flags"].clear()
    with pytest.raises(TypeError, match="FrozenList is immutable"):
        action.arguments["flags"].sort()
    with pytest.raises(TypeError, match="FrozenList is immutable"):
        action.arguments["flags"].reverse()
    with pytest.raises(TypeError, match="FrozenList is immutable"):
        action.arguments["flags"] += ["extra"]

def test_caller_mutation_after_proposal_never_changes_executed_args():
    shield = Shield()
    executed_args_capture = []

    def capturing_tool(arguments):
        executed_args_capture.append(dict(arguments))
        return {"status": "ok"}

    shield.registry.register("create_order", capturing_tool)

    raw_args = {
        "product": "shoes",
        "quantity": 1,
        "nested": {"options": ["gift_wrap"], "meta": {"note": "clean"}}
    }

    # Propose execution
    res = shield.execute(agent="shopping_agent", tool="create_order", arguments=raw_args)
    assert res.execution_status == ExecutionStatus.EXECUTED

    # Malicious caller mutates the original dictionary after proposal
    raw_args["quantity"] = 99999
    raw_args["nested"]["options"].append("exploit")
    raw_args["nested"]["meta"]["note"] = "hacked"
    raw_args["injected_field"] = "evil"

    # Captured arguments passed to the tool must match the original snapshot
    assert len(executed_args_capture) == 1
    executed = executed_args_capture[0]
    assert executed["quantity"] == 1
    assert executed["nested"]["options"] == ["gift_wrap"]
    assert executed["nested"]["meta"]["note"] == "clean"
    assert "injected_field" not in executed

    # Decision arguments also remain completely frozen and untampered
    assert res.decision.arguments["quantity"] == 1
    assert res.decision.arguments["nested"]["options"] == ["gift_wrap"]

def test_concurrent_caller_mutation_during_execution():
    import threading
    import time
    shield = Shield()
    captured_quantities = []

    def order_tool(arguments):
        # Simulate in-flight work while caller attempts concurrent mutation
        time.sleep(0.01)
        captured_quantities.append(arguments["quantity"])
        return {"done": True}

    shield.registry.register("create_order", order_tool)

    raw_args = {"product": "shoes", "quantity": 2, "meta": {"sub": "init"}}

    def mutator():
        # Continually attempt to mutate caller dict while tool executes
        for _ in range(30):
            raw_args["quantity"] = 99999
            raw_args["meta"]["sub"] = "corrupted"
            time.sleep(0.001)

    t = threading.Thread(target=mutator)
    raw_args["quantity"] = 2
    t.start()
    res = shield.execute(agent="shopping_agent", tool="create_order", arguments=raw_args)
    t.join()

    # The tool must either have executed with the authorized snapshot (2)
    # or failed closed if mutated before ingestion; never executed with 99999
    if res.execution_status == ExecutionStatus.EXECUTED:
        assert captured_quantities == [2]
    else:
        assert res.decision.allowed is False
        assert captured_quantities == []

def test_review_queue_snapshot_persists_across_caller_mutations():
    shield = Shield(review_ttl_seconds=60.0)
    executed_args = []

    def refund_tool(arguments):
        executed_args.append(dict(arguments))
        return {"refunded": True}

    shield.registry.register("refund_order", refund_tool)

    from agentshield.policy.rules import PolicyConfiguration, AgentConfig, ToolRule
    shield.policy_engine.config = PolicyConfiguration(
        agents={"manager": AgentConfig(name="manager", allowed_tools=["refund_order"])},
        tools={"refund_order": ToolRule(tool="refund_order", max_amount=100000)}
    )

    raw_args = {
        "amount": 2000,
        "customer": {"id": "c1", "tags": ["vip"]}
    }

    # Authorize triggers REVIEW
    dec = shield.authorize(agent="manager", tool="refund_order", arguments=raw_args)
    assert dec.decision.value == "REVIEW"
    review_id = shield.get_review_queue()[0]["review_id"]

    # Malicious caller attempts TOCTOU mutation while pending in review queue
    raw_args["amount"] = 9999999
    raw_args["customer"]["tags"].append("stolen")
    raw_args["unauthorized_override"] = True

    # Review is approved
    approved_res = shield.approve_review(review_id, approver="alice_reviewer")
    assert approved_res is not None
    assert approved_res.execution_status == ExecutionStatus.EXECUTED

    # Tool must execute with the exact frozen snapshot captured at authorization
    assert len(executed_args) == 1
    executed = executed_args[0]
    assert executed["amount"] == 2000
    assert executed["customer"]["tags"] == ["vip"]
    assert "unauthorized_override" not in executed

def test_safe_execution_adapter_preserves_callable_mutations_compatibility():
    """Registered tool callables that modify arguments in-place should execute without crashing,
    while the validated decision snapshot remains completely immutable."""
    shield = Shield()

    def in_place_mutating_tool(arguments):
        # Tool modifies its arguments dictionary
        arguments["in_place_added"] = "modified_by_tool"
        arguments.pop("product", None)
        return {"result": "success", "keys": list(arguments.keys())}

    shield.registry.register("create_order", in_place_mutating_tool)

    res = shield.execute(agent="shopping_agent", tool="create_order", arguments={"product": "shoes", "quantity": 2})
    assert res.execution_status == ExecutionStatus.EXECUTED
    assert "in_place_added" in res.tool_result["keys"]

    # Validated snapshot in decision was NOT mutated by the tool
    assert "product" in res.decision.arguments
    assert res.decision.arguments["product"] == "shoes"
    assert "in_place_added" not in res.decision.arguments

def test_audit_consistency_with_frozen_normalized_snapshot():
    from agentshield.audit import SQLiteAuditStore
    store = SQLiteAuditStore(db_path=":memory:")
    shield = Shield(audit_store=store)

    shield.registry.register("create_order", lambda args: {"status": "ok"})

    raw_args = {
        "product": "shoes",
        "quantity": 3,
        "destination": "  HTTPS://Api.EXample.COM/orders  ",
        "secret_token": "sk-test1234567890",
        "nested": {"list": [{"name": "item1"}]}
    }

    res = shield.execute(agent="shopping_agent", tool="create_order", arguments=raw_args)
    assert res.execution_status == ExecutionStatus.EXECUTED

    # Query audit store to verify audit consistency
    records = store.query(agent="shopping_agent", tool="create_order")
    assert len(records) == 1
    logged_args = records[0].arguments

    # Normalization applied
    assert logged_args["destination"] == "https://api.example.com/orders"
    # Secret redaction applied
    assert logged_args["secret_token"] == "[REDACTED]"
    # Nested values preserved
    assert logged_args["nested"]["list"][0]["name"] == "item1"
    # Hash chain remains completely valid
    chain_check = store.verify_integrity()
    assert chain_check["valid"] is True
