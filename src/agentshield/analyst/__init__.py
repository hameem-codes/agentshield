"""
AgentShield LLM Security Analyst module.
"""

from .models import (
    AnalysisReport,
    AnalystSeverity,
    AnalysisValidationError,
    ProviderError,
    ReadOnlyViolationError,
    TimelineEntry,
    FindingObservation,
    SuspiciousSequence,
)
from .provider import LLMProvider, MockLLMProvider
from .prompts import SYSTEM_PROMPT, format_telemetry_prompt, escape_untrusted_delimiters
from .service import SecurityAnalyst
from .store import ReportStore, SQLiteReportStore
from .providers.gemini import GeminiProvider, build_gemini_schema

__all__ = [
    "AnalysisReport",
    "AnalystSeverity",
    "AnalysisValidationError",
    "ProviderError",
    "ReadOnlyViolationError",
    "TimelineEntry",
    "FindingObservation",
    "SuspiciousSequence",
    "LLMProvider",
    "MockLLMProvider",
    "GeminiProvider",
    "build_gemini_schema",
    "SYSTEM_PROMPT",
    "format_telemetry_prompt",
    "escape_untrusted_delimiters",
    "SecurityAnalyst",
    "ReportStore",
    "SQLiteReportStore",
]

