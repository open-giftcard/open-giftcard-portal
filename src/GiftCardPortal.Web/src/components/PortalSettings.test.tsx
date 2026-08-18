import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PreferencesProvider } from "../preferences/preferences";
import { PortalSettings } from "./PortalSettings";

const storageKey = "giftcard.portal.preferences";

function renderSettings() {
  return render(
    <PreferencesProvider>
      <PortalSettings />
    </PreferencesProvider>,
  );
}

async function openSettings() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Ayarlar|Settings/ }));
  return user;
}

describe("PortalSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("opens in Turkish for a first-time visitor and switches to English", async () => {
    renderSettings();
    const user = await openSettings();

    expect(screen.getByRole("radio", { name: /Türkçe/ })).toBeChecked();
    expect(screen.getByText("Dil")).toBeVisible();

    await user.click(screen.getByRole("radio", { name: /English/ }));

    expect(screen.getByText("Language")).toBeVisible();
    expect(document.documentElement.lang).toBe("en");
  });

  it("paints the chosen theme and tells native controls about it", async () => {
    renderSettings();
    const user = await openSettings();

    await user.click(screen.getByRole("radio", { name: /Koyu/ }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    await user.click(screen.getByRole("radio", { name: /Açık/ }));

    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("shows each clock format against the same instant", async () => {
    renderSettings();
    const user = await openSettings();

    // 14:05 UTC is the same moment on both clocks, so only the format differs.
    // The sample is rendered in the machine's zone, so the assertion is on the
    // shape rather than on a fixed hour.
    expect(screen.getByRole("radio", { name: /24 saat/ })).toBeChecked();
    const twelveHour = screen.getByRole("radio", { name: /12 saat/ });
    expect(twelveHour.closest("label")).toHaveTextContent(/ÖÖ|ÖS/);
    expect(
      screen.getByRole("radio", { name: /24 saat/ }).closest("label"),
    ).not.toHaveTextContent(/ÖÖ|ÖS/);

    await user.click(twelveHour);
    expect(twelveHour).toBeChecked();
  });

  it("remembers the choices in this browser and nothing else", async () => {
    renderSettings();
    const user = await openSettings();

    await user.click(screen.getByRole("radio", { name: /English/ }));
    await user.click(screen.getByRole("radio", { name: /Dark/ }));
    await user.click(screen.getByRole("radio", { name: /12-hour/ }));

    expect(Object.keys(window.localStorage)).toEqual([storageKey]);
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}")).toEqual(
      {
        language: "en",
        theme: "dark",
        clock: "12h",
      },
    );
  });

  it("restores a stored choice and ignores a corrupted field", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ language: "en", theme: "chartreuse", clock: "12h" }),
    );
    renderSettings();
    await openSettings();

    expect(screen.getByRole("radio", { name: /English/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /12-hour/ })).toBeChecked();
    // The unusable theme falls back on its own without discarding the rest.
    expect(screen.getByRole("radio", { name: /Device/ })).toBeChecked();
  });
});
