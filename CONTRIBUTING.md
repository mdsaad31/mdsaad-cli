# Contributing to mdsaad CLI

First off, thank you for considering contributing to mdsaad CLI! It's people like you that make this tool better for everyone.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Security Guidelines](#security-guidelines)
- [Documentation Guidelines](#documentation-guidelines)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@mdsaad-cli.com](mailto:conduct@mdsaad-cli.com).

### Our Pledge

We pledge to make participation in our project and our community a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 16.0.0 or higher)
- **npm** (version 8.0.0 or higher)
- **Git** (latest stable version)

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/mdsaad/mdsaad-cli.git
cd mdsaad-cli

# Install dependencies
npm install

# Run tests to ensure everything works
npm test

# Start developing
npm run dev
```

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/mdsaad/mdsaad-cli/issues) as you might find that the issue has already been reported.

When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** to demonstrate the steps
- **Describe the behavior you observed** and what behavior you expected
- **Include screenshots or animated GIFs** if applicable
- **Include your environment details** (OS, Node.js version, CLI version)

Use this template for bug reports:

```markdown
**Bug Description:**
A clear and concise description of what the bug is.

**To Reproduce:**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior:**
A clear and concise description of what you expected to happen.

**Screenshots:**
If applicable, add screenshots to help explain your problem.

**Environment:**
- OS: [e.g. Windows 10, macOS 11.0, Ubuntu 20.04]
- Node.js version: [e.g. 16.14.0]
- CLI version: [e.g. 1.0.0]
- Shell: [e.g. bash, zsh, PowerShell]

**Additional Context:**
Add any other context about the problem here.
```

### 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful** to users
- **Include examples** of how the enhancement would work

### 🔐 Security Vulnerabilities

**Do not create public GitHub issues for security vulnerabilities.** Instead, please report security issues privately to [security@mdsaad-cli.com](mailto:security@mdsaad-cli.com). We will respond within 24 hours and keep you updated on the resolution process.

### 📝 Documentation Improvements

We welcome improvements to documentation! This includes:

- README updates
- API documentation
- Code comments
- Example improvements
- Typo fixes

### 🔌 Plugin Development

We encourage community plugin development. See our [Plugin Development Guide](docs/plugins.md) for detailed information on creating plugins.

## Development Setup

### Detailed Setup Instructions

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/mdsaad-cli.git
   cd mdsaad-cli
   ```

3. **Add the upstream repository**:
   ```bash
   git remote add upstream https://github.com/mdsaad/mdsaad-cli.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Create a new branch** for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

6. **Set up your development environment**:
   ```bash
   # Link the CLI for global testing
   npm link
   
   # Verify the setup
   mdsaad --version
   ```

### Development Dependencies

The project uses several development tools:

- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting
- **Jest**: Testing framework
- **Nodemon**: Development server with hot reload
- **Husky**: Git hooks for quality assurance

## Development Workflow

### Branch Management

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/***: Individual feature development
- **hotfix/***: Critical bug fixes
- **release/***: Release preparation

### Commit Message Format

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting changes (not affecting code logic)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks
- `security`: Security improvements

**Examples:**
```bash
feat(calculator): add support for complex numbers
fix(security): resolve rate limiting bypass vulnerability
docs(api): update plugin development examples
test(security): add comprehensive input validation tests
```

### Development Commands

```bash
# Development with hot reload
npm run dev

# Run tests
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:security      # Security tests only
npm run test:watch         # Tests in watch mode

# Code quality
npm run lint               # Check linting
npm run lint:fix           # Fix linting issues
npm run format             # Format code with Prettier
npm run format:check       # Check formatting

# Building
npm run build              # Full build with tests
npm run build:docs         # Generate documentation

# Security
npm run security:audit     # Security vulnerability scan
npm run security:fix       # Fix security vulnerabilities
```

## Testing Guidelines

### Test Categories

1. **Unit Tests** (`tests/unit/`):
   - Test individual functions and classes
   - Mock external dependencies
   - Aim for 95%+ coverage

2. **Integration Tests** (`tests/integration/`):
   - Test component interactions
   - Use real services where appropriate
   - Focus on critical workflows

3. **End-to-End Tests** (`tests/e2e/`):
   - Test complete user scenarios
   - Use the CLI as users would
   - Validate final outputs

4. **Security Tests** (`tests/unit/security.test.js`):
   - Test input validation and sanitization
   - Verify encryption and authentication
   - Validate network security measures

5. **Performance Tests** (`tests/performance/`):
   - Measure execution time and memory usage
   - Validate performance under load
   - Ensure optimization effectiveness

### Writing Tests

#### Test Structure

```javascript
describe('Component Name', () => {
  let component;
  let mockDependency;

  beforeEach(() => {
    // Setup code
    mockDependency = jest.fn();
    component = new Component(mockDependency);
  });

  afterEach(() => {
    // Cleanup code
    jest.clearAllMocks();
  });

  describe('method name', () => {
    test('should handle normal case', () => {
      // Test implementation
      const result = component.method('input');
      expect(result).toBe('expected');
    });

    test('should handle edge case', () => {
      // Edge case testing
      expect(() => component.method(null)).toThrow('Expected error');
    });
  });
});
```

#### Security Test Example

```javascript
describe('Input Validation', () => {
  test('should prevent SQL injection', () => {
    const maliciousInput = "'; DROP TABLE users; --";
    expect(() => validator.validate(maliciousInput, 'text'))
      .toThrow('Invalid input detected');
  });

  test('should sanitize XSS attempts', () => {
    const xssInput = '<script>alert("xss")</script>';
    const sanitized = validator.sanitize(xssInput, 'html');
    expect(sanitized).not.toContain('<script>');
  });
});
```

### Test Coverage Requirements

- **Unit Tests**: 95% line coverage minimum
- **Integration Tests**: 85% feature coverage
- **Security Tests**: 100% security function coverage
- **Overall**: 85% total coverage

## Security Guidelines

Security is paramount in this project. All contributors must follow these guidelines:

### Security Best Practices

1. **Input Validation**: Always validate and sanitize user inputs
2. **Authentication**: Use proper authentication mechanisms
3. **Encryption**: Encrypt sensitive data at rest and in transit
4. **Access Control**: Implement proper authorization checks
5. **Error Handling**: Don't expose sensitive information in errors
6. **Dependencies**: Keep dependencies updated and audit regularly

### Security Code Review Checklist

Before submitting code, ensure:

- [ ] All user inputs are validated
- [ ] Sensitive data is properly encrypted
- [ ] Authentication is implemented correctly
- [ ] Authorization checks are in place
- [ ] Error messages don't leak sensitive information
- [ ] Dependencies are up to date
- [ ] Security tests are included and passing

### Reporting Security Issues

**Never create public issues for security vulnerabilities.** Report them privately to [security@mdsaad-cli.com](mailto:security@mdsaad-cli.com).

## Documentation Guidelines

### Code Documentation

- Use JSDoc for function and class documentation
- Include parameter types and return values
- Provide examples for complex functions
- Document security considerations

```javascript
/**
 * Validates user input against specified type with security checks
 * @param {string} input - The input to validate
 * @param {string} type - Validation type (email, url, etc.)
 * @param {Object} [options={}] - Optional validation configuration
 * @returns {string} Validated and sanitized input
 * @throws {ValidationError} When input fails validation
 * @example
 * const email = validator.validate('user@example.com', 'email');
 * @security Prevents XSS, SQL injection, and path traversal attacks
 */
function validate(input, type, options = {}) {
  // Implementation
}
```

### README Updates

When adding new features:

1. Update the feature list
2. Add usage examples
3. Update installation instructions if needed
4. Include any new configuration options

### API Documentation

- Document all public APIs
- Include request/response examples
- Document error conditions
- Provide integration examples

## Pull Request Process

### Before Submitting

1. **Rebase your branch** on the latest upstream/main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run the full test suite**:
   ```bash
   npm run build
   ```

3. **Update documentation** if needed

4. **Test your changes** manually

### Pull Request Template

Use this template for your pull request:

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Security improvement

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Security tests pass
- [ ] Manual testing completed

## Security Checklist
- [ ] Input validation implemented
- [ ] Authentication/authorization considered
- [ ] Sensitive data handling reviewed
- [ ] Security tests added/updated

## Documentation
- [ ] README updated (if needed)
- [ ] API documentation updated (if needed)
- [ ] Code comments added/updated
- [ ] CHANGELOG updated

## Screenshots
If applicable, add screenshots to help explain your changes.

## Additional Notes
Any additional information reviewers should know.
```

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one maintainer must review
3. **Security Review**: Security-sensitive changes need security team review
4. **Testing**: Comprehensive testing validation
5. **Documentation**: Documentation completeness check

## Style Guide

### JavaScript Style

We use ESLint and Prettier for code style enforcement. Key guidelines:

- Use `const` for immutable values, `let` for mutable values
- Prefer arrow functions for callbacks
- Use template literals for string interpolation
- Use async/await instead of callbacks
- Use destructuring where appropriate
- Follow naming conventions (camelCase for variables, PascalCase for classes)

### File Organization

```
src/
├── commands/          # CLI command implementations
├── services/          # Core services and utilities
├── utils/             # Helper utilities
├── config/            # Configuration files
└── cli.js            # Main CLI entry point

tests/
├── unit/             # Unit tests
├── integration/      # Integration tests
├── e2e/             # End-to-end tests
├── performance/      # Performance tests
└── helpers/         # Test utilities

docs/
├── api/             # API documentation
├── guides/          # User guides
└── examples/        # Usage examples
```

### Naming Conventions

- **Files**: kebab-case (`my-service.js`)
- **Variables**: camelCase (`myVariable`)
- **Functions**: camelCase (`myFunction`)
- **Classes**: PascalCase (`MyClass`)
- **Constants**: UPPER_SNAKE_CASE (`MY_CONSTANT`)
- **Commands**: kebab-case (`my-command`)

## Community

### Getting Help

- **GitHub Discussions**: For questions and community discussions
- **GitHub Issues**: For bug reports and feature requests
- **Email**: [support@mdsaad-cli.com](mailto:support@mdsaad-cli.com) for direct support

### Recognition

We recognize contributors in several ways:

- **Contributors file**: All contributors are listed in CONTRIBUTORS.md
- **Release notes**: Significant contributions are highlighted in release notes
- **Badge system**: GitHub badges for different types of contributions

### Code Review Culture

We strive for constructive, helpful code reviews:

- **Be respectful**: Focus on the code, not the person
- **Be specific**: Provide clear, actionable feedback
- **Be educational**: Explain the reasoning behind suggestions
- **Be collaborative**: Work together to improve the code

### Mentorship

New contributors can request mentorship:

- **Getting Started**: Help with setup and first contributions
- **Code Review**: Guidance on best practices and patterns
- **Security**: Security-focused mentorship for security contributions

## License

By contributing to mdsaad CLI, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to mdsaad CLI! Your efforts help make this tool better for everyone. 🎉