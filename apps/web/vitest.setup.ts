import { vi } from "vitest";

// Mock @plane/constants — prevent deep monorepo resolution
vi.mock("@plane/constants", () => ({
  API_BASE_URL: "",
  EUserWorkspaceRoles: { ADMIN: 20, MEMBER: 15, GUEST: 10 },
  EUserPermissionsLevel: { WORKSPACE: "WORKSPACE", PROJECT: "PROJECT" },
  GROUPED_PROJECT_SETTINGS: {},
  PROJECT_SETTINGS_CATEGORIES: [],
}));

// Mock @plane/i18n — return the translation key as-is
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), key);
      }
      return key;
    },
  }),
}));

// Mock mobx-react — observer is a passthrough HOC
vi.mock("mobx-react", () => ({
  observer: <T>(component: T): T => component,
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
  ModalCore: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => {
    if (!isOpen) return null;
    const React = require("react");
    return React.createElement("div", { "data-testid": "modal", role: "dialog" }, children);
  },
  Button: ({
    children,
    onClick,
    loading,
    disabled,
    ...rest
  }: {
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
  ToggleSwitch: ({ value, onChange }: { value: boolean; onChange: () => void }) => {
    const React = require("react");
    return React.createElement(
      "button",
      { role: "switch", "aria-checked": value, onClick: onChange },
      value ? "ON" : "OFF"
    );
  },
}));

// Mock @plane/propel/toast
vi.mock("@plane/propel/toast", () => ({
  TOAST_TYPE: { SUCCESS: "success", ERROR: "error", WARNING: "warning", INFO: "info" },
  setToast: vi.fn(),
}));

// Mock @plane/utils
vi.mock("@plane/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Mock @plane/types — types are compile-time only, runtime mock is empty
vi.mock("@plane/types", () => ({}));

// Mock lucide-react icons as simple spans
vi.mock(
  "lucide-react",
  () =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (typeof prop !== "string") return undefined;
          const React = require("react");
          return (props: Record<string, unknown>) => React.createElement("span", { "data-icon": prop, ...props });
        },
      }
    )
);

// Mock @/services/api.service — prevent axios resolution
vi.mock("@/services/api.service", () => ({
  APIService: class {
    
    get() {
      return Promise.resolve({ data: null });
    }
    post() {
      return Promise.resolve({ data: null });
    }
    patch() {
      return Promise.resolve({ data: null });
    }
    delete() {
      return Promise.resolve({ data: null });
    }
    put() {
      return Promise.resolve({ data: null });
    }
  },
}));

// Mock store and hooks to prevent loading the entire app store tree
vi.mock("@/lib/store-context", () => ({
  StoreContext: { Provider: ({ children }: { children: unknown }) => children },
}));

vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({
    getWorkspaceRoleByWorkspaceSlug: () => 20,
    allowPermissions: () => true,
  }),
}));

// Mock the care service to prevent @plane/constants resolution
vi.mock("@/plane-web/services/care.service", () => ({
  default: {
    getSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    getCurrentBalance: vi.fn(),
    getBalanceHistory: vi.fn(),
    getCareOverview: vi.fn(),
    getWorklogEntries: vi.fn(),
    createWorklogEntry: vi.fn(),
    deleteWorklogEntry: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    getActiveTimer: vi.fn(),
    getRecurrence: vi.fn(),
    createRecurrence: vi.fn(),
    updateRecurrence: vi.fn(),
    deleteRecurrence: vi.fn(),
  },
}));

// Mock the care store to prevent MobX tree loading
vi.mock("@/plane-web/store/care", () => ({
  CareStore: vi.fn(),
}));

// Mock common layout components used in worklog
vi.mock("@/components/common/layout/sidebar/property-list-item", () => ({
  SidebarPropertyListItem: ({ children, label }: { children: React.ReactNode; label: string }) => {
    const React = require("react");
    return React.createElement("div", { "data-testid": "sidebar-item", "data-label": label }, children);
  },
}));
