# Contributing to Vishleshan

Thank you for your interest in contributing to **Vishleshan — Multi-Agent Recruitment Intelligence Platform**! We welcome contributions from developers, recruiters, and AI researchers to help build and scale this platform.

---

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful, constructive, and inclusive.
- Keep discussions professional and focused on the technical scope of the project.
- Report any inappropriate behavior to the project maintainers.

---

## How Can I Contribute?

### 1. Reporting Bugs
- Search existing GitHub Issues before opening a new one.
- Use the **Bug Report** template if available.
- Include details about your environment (OS, Python/Node versions), reproduction steps, and error logs.

### 2. Suggesting Enhancements
- Explain the behavior you would like to see and why it would be beneficial.
- Provide mockups or design outlines if the suggestion involves changes to the UI.

### 3. Submitting Code Changes
- Fork the repository and create a branch from `main`.
- Follow the branching naming conventions:
  - `feature/your-feature-name` for new features
  - `bugfix/issue-description` for bug fixes
  - `docs/update-info` for documentation changes
- Commit your changes with clear, descriptive commit messages.

---

## Development Setup

Please refer to the [README.md](README.md) for detailed instructions on setting up the local Django backend and React Vite frontend.

### Pre-requisites
- **Python 3.10+** (Backend)
- **Node.js 18+** (Frontend)
- **Redis** & **PostgreSQL** running locally or remotely

### Backend Guidelines
- Always write clean, self-documenting code.
- Avoid introducing circular imports in Django modules.
- Place new API views in `backend/api/views/` and register them in `backend/api/urls.py`.

### Frontend Guidelines
- Use React hooks and functional components.
- Style with Tailwind CSS utility classes.
- Manage global states using `zustand` stores located in `frontend/src/stores/`.
- Verify the build by running `npm run build` locally before pushing.

---

## Code Style

- **Python**: Follow PEP 8 guidelines. Keep imports organized (standard library first, third-party libraries second, local imports last).
- **JavaScript/React**: Code should pass ESLint checks without errors. Run `npm run lint` in the `frontend/` directory to inspect potential styling and code safety issues.
