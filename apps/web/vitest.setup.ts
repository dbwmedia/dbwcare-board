import { vi } from "vitest";

// Mock @plane/i18n — return the translation key as-is
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return Object.entries(params).reduce(
          (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
          key
        );
      }
      return key;
    },
  }),
}));

// Mock mobx-react — observer is a passthrough HOC
vi.mock("mobx-react", () => ({
  observer: <T,>(component: T): T => component,
}));

// Mock react-router (useParams, Link, etc.)
vi.mock("react-router", () => ({
  useParams: vi.fn(() => ({})),
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode; [key: string]: unknown }) => {
    const React = require("react");
    return React.createElement("a", { href: to, ...rest }, children);
  },
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({ pathname: "/", search: "", hash: "" })),
}));

// Mock @plane/ui — provide minimal implementations for commonly used components
vi.mock("@plane/ui", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  ModalCore: ({ isOpen, children, handleClose }: { isOpen: boolean; children: React.ReactNode; handleClose: () => void }) => {
    if (!isOpen) return null;
    const React = require("react");
    return React.createElement("div", { "data-testid": "modal", role: "dialog" }, children);
  },
  Button: ({ children, onClick, loading, disabled, ...rest }: {
    children: React.ReactNode;
    onClick?: () => void;
    loading?: boolean;
    disabled?: boolean;
    [key: string]: unknown;
  }) => {
    const React = require("react");
    return React.createElement("button", { onClick, disabled: disabled || loading, ...rest }, children);
  },
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
    const React = require("react");
    return React.createElement("input", props);
  },
}));

// Mock @plane/utils
vi.mock("@plane/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Mock lucide-react icons as simple spans
vi.mock("lucide-react", () =>
  new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop !== "string") return undefined;
        const React = require("react");
        return (props: Record<string, unknown>) =>
          React.createElement("span", { "data-icon": prop, ...props });
      },
    }
  )
);
