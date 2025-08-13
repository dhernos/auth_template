// A configuration file that defines the protected routes and their roles.
export const protectedRoutes = [
  { path: "/admin", roles: ["ADMIN"] },
  { path: "/editor", roles: ["ADMIN", "EDITOR"] },
];