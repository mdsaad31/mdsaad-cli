# Calculate Command Documentation

## Overview

The **calculate** command provides a powerful mathematical calculation engine built on top of the math.js library. It supports basic arithmetic, advanced mathematical functions, scientific calculations, and includes comprehensive expression preprocessing and error handling.

## Usage

```bash
mdsaad calculate <expression> [options]
mdsaad calculate help           # Show help information
mdsaad calculate history        # Show calculation history
mdsaad calculate constants      # Show available constants
mdsaad calculate functions      # Show available functions
mdsaad calculate clear          # Clear calculation history
```

## Features

### Basic Arithmetic
- **Addition**: `2 + 3` → `5`
- **Subtraction**: `10 - 4` → `6`
- **Multiplication**: `3 * 4` → `12`
- **Division**: `15 / 3` → `5`
- **Exponentiation**: `2^8` → `256`
- **Modulo**: `17 mod 5` → `2`

### Scientific Functions
- **Trigonometric**: `sin(pi/2)`, `cos(0)`, `tan(pi/4)`
- **Inverse Trigonometric**: `asin(1)`, `acos(0)`, `atan(1)`
- **Hyperbolic**: `sinh(0)`, `cosh(0)`, `tanh(0)`
- **Logarithmic**: `log(10)`, `ln(e)`, `log10(100)`
- **Exponential**: `exp(1)`, `sqrt(16)`, `cbrt(27)`

### Mathematical Constants
- **pi** (π): `3.141592653589793`
- **e**: `2.718281828459045` (Euler's number)
- **phi** (φ): `1.618033988749895` (Golden ratio)
- **tau** (τ): `6.283185307179586` (2π)
- **lightSpeed**: `299792458` (Speed of light in m/s)
- **gravity**: `9.80665` (Standard gravity in m/s²)
- **avogadro**: `6.02214076e23` (Avogadro's number)

### Advanced Features

#### Expression Preprocessing
The calculator automatically handles various input formats:
- **Symbol replacement**: `×` → `*`, `÷` → `/`, `π` → `pi`
- **Percentage conversion**: `25%` → `(25/100)`
- **Factorial notation**: `5!` → `factorial(5)`
- **Implicit multiplication**: `2(3+4)` → `2*(3+4)`, `3pi` → `3*pi`

#### Number Formatting
Results are automatically formatted with appropriate precision:
- **Decimal numbers**: `3.14159`
- **Scientific notation**: Large/small numbers shown as `1.234568e+9`
- **Alternative formats**: Binary, hexadecimal, and fractional representations

#### Error Handling
Comprehensive error messages for:
- **Syntax errors**: Invalid mathematical expressions
- **Undefined symbols**: Unknown functions or variables
- **Division by zero**: Mathematical impossibilities
- **Domain errors**: Invalid input ranges for functions

## Examples

### Basic Calculations
```bash
# Simple arithmetic
mdsaad calculate "2 + 3 * 4"
# Result: 14

# Scientific functions
mdsaad calculate "sin(pi/2) + cos(0)"
# Result: 2

# Factorial and powers
mdsaad calculate "5! + 2^10"
# Result: 1144
```

### Advanced Expressions
```bash
# Complex mathematical expressions
mdsaad calculate "sqrt(sin(pi/4)^2 + cos(pi/4)^2)"
# Result: 1

# Percentage calculations
mdsaad calculate "25% * 200 + sqrt(64)"
# Result: 58

# Logarithmic calculations
mdsaad calculate "log(e^3) + ln(e^2)"
# Result: 5
```

### Special Commands
```bash
# Get help
mdsaad calculate help

# View available constants
mdsaad calculate constants

# View available functions
mdsaad calculate functions

# Clear calculation history
mdsaad calculate clear
```

## Configuration

The calculate command respects the following configuration options:
- **saveHistory**: Store calculation history (default: true)
- **precision**: Number precision settings (managed by math.js)

## Supported Operations

### Arithmetic Functions
- `add`, `subtract`, `multiply`, `divide`, `mod`, `pow`

### Trigonometric Functions
- `sin`, `cos`, `tan`, `asin`, `acos`, `atan`
- `sinh`, `cosh`, `tanh`

### Exponential and Logarithmic
- `exp`, `log`, `log10`, `ln`, `sqrt`, `cbrt`

### Rounding and Utility
- `round`, `ceil`, `floor`, `abs`, `sign`
- `min`, `max`, `random`

### Statistical Functions
- `mean`, `median`, `mode`, `std`

### Special Functions
- `factorial`, `gcd`, `lcm`

## Implementation Details

### Architecture
- **Engine**: Built on math.js with BigNumber precision support
- **History**: Maintains last 100 calculations in memory
- **Persistence**: History saved to configuration (optional)
- **Error Recovery**: Graceful handling of invalid expressions

### Performance
- **Startup Time**: < 100ms for simple expressions
- **Execution Time**: Tracked and displayed for complex calculations
- **Memory Usage**: Efficient caching of results and history

### Security
- **Input Sanitization**: All expressions validated before evaluation
- **Safe Evaluation**: Uses math.js safe evaluation context
- **No Code Execution**: Pure mathematical expressions only

## Testing

The calculate command includes comprehensive tests covering:
- Expression preprocessing and formatting
- Mathematical operations and edge cases
- Error handling and recovery
- Number formatting and precision
- History management and persistence

Run tests with:
```bash
npm test -- tests/commands/calculate.test.js
```

## Dependencies

- **mathjs**: ^14.8.1 - Mathematical expression parser and evaluator
- **chalk**: For colored console output
- **i18n service**: For internationalization support
- **config service**: For settings and history persistence

## Future Enhancements

Potential improvements for future versions:
- **Unit conversions**: Length, weight, temperature, currency
- **Graphing**: ASCII plots for functions
- **Variables**: User-defined variables and functions
- **Equation solving**: Solve for x in equations
- **Matrix operations**: Advanced linear algebra support
- **Programming mode**: Hexadecimal, binary, and bitwise operations