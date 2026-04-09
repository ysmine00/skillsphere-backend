# SkillSphere Backend

Node.js/Express backend API for SkillSphere - A community skill-exchange platform developed for Al Akhawayn University.

## About

SkillSphere is a database-driven platform that facilitates skill sharing within the AUI community. This backend provides RESTful API endpoints for user authentication, skill offerings, skill requests, and exchange coordination.

**Course Project:** CSC 3326 – Database Systems (Spring 2025)  
**Developer:** Yasmine Kouch  
**Supervisor:** Dr. Lamiae Bouanane

## Tech Stack

- Node.js + Express.js
- PostgreSQL 14+
- JWT Authentication
- Bcrypt for password hashing

## Installation
```bash
npm install
createdb skillsphere
psql -d skillsphere -f schema.sql
npm start
```

See SQL.pdf for complete database schema.

## Contact

**GitHub:** [@ysmine00](https://github.com/ysmine00)
