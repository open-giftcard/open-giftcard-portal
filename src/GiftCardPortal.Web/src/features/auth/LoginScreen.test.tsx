import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginScreen } from "./LoginScreen";

describe("LoginScreen", () => {
  it("submits a trimmed staff email and password", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<LoginScreen isPending={false} onLogin={onLogin} />);

    await user.type(
      screen.getByRole("textbox", { name: "Email address" }),
      "  staff@example.test  ",
    );
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in securely" }));

    expect(onLogin).toHaveBeenCalledWith(
      "staff@example.test",
      "correct-password",
    );
  });

  it("keeps sign in unavailable until both fields have values", async () => {
    const user = userEvent.setup();
    render(<LoginScreen isPending={false} onLogin={vi.fn()} />);

    const submit = screen.getByRole("button", { name: "Sign in securely" });
    expect(submit).toBeDisabled();

    await user.type(
      screen.getByRole("textbox", { name: "Email address" }),
      "staff@example.test",
    );
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Password"), "correct-password");
    expect(submit).toBeEnabled();
  });
});
