# digi-opo — Project Documentation Guide

## Overview

**digi-opo** is a standalone desktop application for career exploration that uses a simple two-card comparison model. The app is designed to aggregate global preference data from user decisions without requiring individual user accounts. The documentation below describes goals, architecture, usage, data models, and structure recommendations for Markdown documentation.

---

## Purpose and Vision

### Purpose

* Provide a low-friction way to explore and compare careers (ammatit) using paired comparisons.
* Collect and display global preference statistics, preserving user anonymity.

### Vision

* A minimal-friction user experience that helps users discover careers by comparing options.
* Career data and aggregated results are prioritized; educational qualifications (tutkinnot) are structured as supporting metadata.

---

## Project Structure

Below is an example repository layout:

```
digi-opo/
├── src/
│   ├── ui/
│   ├── logic/
│   ├── db/
│   └── api/
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```


---

## Technology Stack

| Component     | Technology (example)     |
| ------------- | ------------------------ |
| Backend Logic | Node.js / Python         |
| Database      | SQLite                   |

---

## Required languages to use:
- Python
- JavaScript
- TypeScript
- HTML
- CSS

With the most focus on TypeScript for this project.


---

## Key Concepts

### Core Entities

**Ammatti**

* Unique identifier
* Name
* One representative image
* Primary color (for consistent UI)
* External career reference (e.g., ePerusteet link)

**Tutkinto**

* Academic qualification
* One-to-many relationship with ammatit

**Tags**

* Multiple categorical descriptors applied to ammatit

**Results**

* Aggregated global preference data (no user accounts)

