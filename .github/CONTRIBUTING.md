# Contributing to Perun Core

Thank you for your interest in contributing to Perun Core, the front-end module of the [Svarog Business Platform](https://github.com/PerunTech/svarog).

## Prerequisites

- [Node.js](https://nodejs.org/) v22.12.0 or higher
- [pnpm](https://pnpm.io/) v9 or higher
- Java JDK (for the OSGi bundle build via Maven)

## Getting Started

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/perun-core.git
   cd perun-core
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

## Development Workflow

### Branching

- Base your branch off `dev`.
- Use descriptive branch names, e.g. `feature/session-token-header` or `fix/grid-reload`.

### Making Changes

- Keep changes focused — one feature or fix per pull request.
- Run the linter before committing:
  ```bash
  pnpm lint
  ```
- Build the bundle to verify it compiles cleanly:
  ```bash
  pnpm build-dev
  ```

### Commit Messages

Follow the format: `type(scope): short description`

Common types: `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`

Examples:
```
feat(grid): add reload-all-grids action
fix(router): resolve page reload issue
chore(deps): upgrade axios to 1.8.3
```

## Submitting a Pull Request

1. Push your branch to your fork.
2. Open a pull request against the `dev` branch of this repository.
3. Describe what changed and why.
4. Link any related issues.

## Reporting Issues

Open an issue on GitHub and include:
- A clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Browser and Node.js version if relevant

## License

By contributing, you agree that your contributions will be licensed under the [Apache 2.0 License](LICENSE).
