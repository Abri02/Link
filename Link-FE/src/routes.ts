import type { ComponentType, LazyExoticComponent } from "react";
import { lazy } from "react";

export interface RouteConfig {
  path: string;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  /** Redirect unauthenticated users to /login. */
  protected?: boolean;
  /** Redirect already-authenticated users to /. */
  publicOnly?: boolean;
}

const routes: RouteConfig[] = [
  {
    path: "/login",
    publicOnly: true,
    component: lazy(() =>
      import("./feature/auth/pages/LoginPage").then((m) => ({ default: m.LoginPage }))
    ),
  },
  {
    path: "/signup",
    publicOnly: true,
    component: lazy(() =>
      import("./feature/auth/pages/RegisterPage").then((m) => ({ default: m.RegisterPage }))
    ),
  },
  {
    path: "/",
    component: lazy(() =>
      import("./feature/workspace/pages/WorkspacePage").then((m) => ({ default: m.WorkspacePage }))
    ),
    protected: true,
  },
];

export default routes;
