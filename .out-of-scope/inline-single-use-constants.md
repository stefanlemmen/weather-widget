# Inline single-use constants

Values in the code stay named constants, also when they're used once, such as a query parameter value or a unit factor. We don't inline them as literals.

## Why this is out of scope

The project's coding standard is to use named, exported constants instead of magic strings and hardcoded values, including for config objects. A name tells the reader what a value means and gives it one place to change. Inlining single-use values would make the code inconsistent with that rule.

## Prior requests

- #56: "Inline single-use constants"
