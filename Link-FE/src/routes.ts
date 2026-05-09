import type { ComponentType, LazyExoticComponent } from "react";
import { lazy } from "react";

export interface RouteConfig {
  path: string;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  /** Redirect unauthenticated users to this path. Omit for public routes. */
  protected?: boolean;
}

const routes: RouteConfig[] = [
  {
    path: "/login",
    component: lazy(() =>
      import("./feature/auth/pages/LoginPage").then((m) => ({ default: m.LoginPage }))
    ),
  },
  {
    path: "/signup",
    component: lazy(() =>
      import("./feature/auth/pages/RegisterPage").then((m) => ({ default: m.RegisterPage }))
    ),
  },
  {
    path: "/",
    component: lazy(() =>
      import("./feature/HomePage").then((m) => ({ default: m.HomePage }))
    ),
    protected: true,
  },
];

export default routes;
