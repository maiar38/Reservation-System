# Reservation Management System

A REST API for booking rooms, built with NestJS, TypeScript, MongoDB and Mongoose.

> **Status:** Auth, Users and Resources are done. Reservations is in progress.

## Core functionality

- **Auth:** register, login, refresh and logout using JWT access and refresh tokens. Passwords are hashed with bcrypt, and each refresh token works only once.
- **Roles:** `ADMIN` and `CUSTOMER`. New users are always customers; the first admin is created with the seed script.
- **Users:** everyone can view and update their own profile. Admins can list users, view a user by id, and activate or deactivate accounts. A deactivated user is logged out and can't log in.
- **Resources:** rooms with a type, capacity and operating hours. Admins create, update and delete them (delete is a soft delete). Everyone signed in can list, search and filter them by type and minimum capacity.
- **Errors:** one global filter returns every error in the same format (`statusCode`, `message`, `path`, `timestamp`).

## Important commands

```bash
npm install          # install dependencies
cp .env.example .env # then fill in MongoDB URI, JWT secrets and admin login
npm run seed         # create the admin account
npm run start:dev    # start the app in watch mode
```

- API: `http://localhost:3000/api/v1`
- Swagger docs: `http://localhost:3000/api/docs`

## Testing

Open the `bruno/` folder in [Bruno](https://www.usebruno.com/), pick the **Local** environment, and run the folders in order (Auth, Users, Resources) against a fresh database.
