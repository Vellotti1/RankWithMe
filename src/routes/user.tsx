import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/user")({
  component: UserLayout,
});

function UserLayout() {
  return <Outlet />;
}
