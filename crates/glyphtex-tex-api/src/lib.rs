#![doc = include_str!("../README.md")]

pub mod api;
pub mod logparse;

pub use api::{
    CompileOptions, CompileResult, CompileStatus, Diagnostic, LogLevel, OutputFile, OutputFormat,
    OutputKind, Severity,
};
pub use logparse::parse as parse_log;
