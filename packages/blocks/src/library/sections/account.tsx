import { defineSection, f } from "../../core";
import { AccountView, type AccountData } from "../account";

const sample: AccountData = {
  user: { name: "Alex Martin", email: "alex@example.com" },
  orders: [
    {
      number: "SHOP-1A2B3C",
      status: "SHIPPED",
      total: "1249.00",
      currency: "EUR",
      createdAt: "2026-01-15T10:00:00.000Z",
      items: [{ name: "Sample product", variant: null, quantity: 1 }],
    },
  ],
};

const text = (label: string, value: string) => f.text({ label, default: value, inline: false });

export const Account = defineSection({
  name: "Account",
  label: "Customer account",
  description: "Sign in / create account, then the customer's profile and orders.",
  category: "commerce",
  icon: "user",
  requires: ["accounts"],
  keywords: ["account", "login", "sign in", "register", "orders", "profile"],
  fields: {
    greeting: text("Greeting ({name} = customer)", "Hello, {name}"),
    ordersTitle: text("Orders title", "Your orders"),
    noOrders: text("No orders text", "You haven't placed an order yet."),
    editorPreview: f.select(["signed-in", "guest"], { label: "Preview in editor", default: "signed-in", group: "style" }),
    form: f.group(
      {
        signInTab: text("Sign-in tab", "Sign in"),
        signUpTab: text("Create-account tab", "Create account"),
        name: text("Name field", "Full name"),
        email: text("Email field", "Email"),
        password: text("Password field", "Password (8+ characters)"),
        signIn: text("Sign-in button", "Sign in"),
        signUp: text("Create-account button", "Create account"),
        signOut: text("Sign-out button", "Sign out"),
        openPanel: text("Open panel button (staff only)", "Open Qubo"),
      },
      { label: "Form labels", collapsed: true },
    ),
    errors: f.group(
      {
        invalidCredentials: text("Wrong email or password", "Incorrect email or password."),
        emailTaken: text("Email already registered", "An account already exists for this email. Sign in instead."),
        weakPassword: text("Password too short", "Use at least 8 characters."),
        error: text("Generic error", "Something went wrong. Please try again."),
      },
      { label: "Error messages", collapsed: true },
    ),
    statuses: f.group(
      {
        PENDING: text("Pending", "Pending"),
        CONFIRMED: text("Confirmed", "Confirmed"),
        PROCESSING: text("Processing", "Processing"),
        SHIPPED: text("Shipped", "Shipped"),
        DELIVERED: text("Delivered", "Delivered"),
        COMPLETED: text("Completed", "Completed"),
        CANCELLED: text("Cancelled", "Cancelled"),
        REFUNDED: text("Refunded", "Refunded"),
      },
      { label: "Order statuses", collapsed: true },
    ),
  },
  render: (p, ctx) => {
    const editing = ctx.isEditing || !ctx.metadata.site?.id;
    return (
      <AccountView
        locale={ctx.metadata.site?.locale ?? ctx.metadata.locale ?? "en"}
        preview={editing ? (p.editorPreview === "guest" ? "guest" : sample) : undefined}
        labels={{
          ...p.form,
          ...p.errors,
          greeting: p.greeting,
          ordersTitle: p.ordersTitle,
          noOrders: p.noOrders,
          statuses: p.statuses,
        }}
      />
    );
  },
});

export const accountSections = [Account];
