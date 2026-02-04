// Helper for comma-separated lists that must have at least one element.
function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

module.exports = grammar({
  name: "structured_agent",
  word: ($) => $.identifier,
  extras: ($) => [/\s/, $.comment],

  // This conflict is necessary because an `if` without an `else` could be interpreted
  // as either an incomplete `if_else_expression` or a complete `expression_statement`.
  // Giving `if_else_expression` higher precedence resolves this.
  conflicts: ($) => [[$.if_else_expression, $.expression_statement]],

  rules: {
    source_file: ($) => repeat1($.definition),
    definition: ($) =>
      choice($.function_declaration, $.external_function_declaration),
    comment: ($) => token(seq("#", /.*/)),

    // Functions
    function_declaration: ($) =>
      seq(
        repeat($.comment),
        "fn",
        field("name", $.identifier),
        field("parameters", $.parameter_list),
        ":",
        field("return_type", $.type),
        field("body", $.block),
      ),
    external_function_declaration: ($) =>
      seq(
        repeat($.comment),
        "extern",
        "fn",
        field("name", $.identifier),
        field("parameters", $.parameter_list),
        ":",
        field("return_type", $.type),
      ),

    parameter_list: ($) => seq("(", optional(sepBy1(",", $.parameter)), ")"),
    parameter: ($) =>
      seq(field("name", $.identifier), ":", field("type", $.type)),

    // A type can only be one of the built-in primitives. This strictly follows `parser.rs`.
    type: ($) => choice("String", "Boolean", $.unit_type),
    unit_type: ($) => seq("(", ")"),

    block: ($) => seq("{", repeat($.statement), "}"),

    // Statements
    statement: ($) =>
      choice(
        $.let_declaration,
        $.variable_assignment,
        $.if_statement,
        $.while_statement,
        $.return_statement,
        $.injection,
        $.expression_statement,
      ),

    let_declaration: ($) =>
      seq(
        "let",
        field("name", $.identifier),
        "=",
        field("value", $.expression),
      ),
    variable_assignment: ($) =>
      seq(field("name", $.identifier), "=", field("value", $.expression)),
    if_statement: ($) =>
      prec.right(
        seq(
          "if",
          field("condition", $._simple_expression),
          field("consequence", $.block),
          optional(seq("else", field("alternative", $.block))),
        ),
      ),
    while_statement: ($) =>
      seq(
        "while",
        field("condition", $._simple_expression),
        field("body", $.block),
      ),
    return_statement: ($) => prec.right(seq("return", optional($.expression))),
    injection: ($) => seq($.expression, "!"),
    expression_statement: ($) => $.expression,

    // Expressions (Two-tiered structure)
    expression: ($) =>
      choice($.select_expression, $.if_else_expression, $._simple_expression),

    if_else_expression: ($) =>
      prec.right(
        1, // Higher precedence
        seq(
          "if",
          field("condition", $._simple_expression),
          field("consequence", seq("{", $.expression, "}")),
          "else",
          field("alternative", seq("{", $.expression, "}")),
        ),
      ),

    _simple_expression: ($) =>
      choice(
        $.function_call,
        $.string_literal,
        $.boolean_literal,
        $.identifier, // Corresponds to `parse_variable`
      ),

    function_call: ($) =>
      seq(field("function", $.identifier), field("arguments", $.argument_list)),
    argument_list: ($) => seq("(", optional(sepBy1(",", $.argument)), ")"),
    argument: ($) => choice($.placeholder, $._simple_expression),

    select_expression: ($) =>
      seq("select", "{", optional(sepBy1(",", $.select_clause)), "}"),
    select_clause: ($) =>
      seq(
        field("call", $.function_call),
        "as",
        field("binding", $.identifier),
        "=>",
        field("result", $.expression),
      ),

    // Literals and Identifiers
    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,
    string_literal: ($) =>
      choice(
        // `"hello"`
        seq(
          '"',
          repeat(
            choice(token.immediate(prec(1, /[^"\\]+/)), $.escape_sequence),
          ),
          '"',
        ),
        // `'''hello'''` (using single quotes as per parser tests)
        seq(
          "'''",
          repeat(choice(token.immediate(prec(1, /[^']+/)), $.escape_sequence)),
          "'''",
        ),
      ),
    escape_sequence: ($) => token.immediate(seq("\\", /./)),
    boolean_literal: ($) => choice("true", "false"),
    placeholder: ($) => "_",
  },
});
