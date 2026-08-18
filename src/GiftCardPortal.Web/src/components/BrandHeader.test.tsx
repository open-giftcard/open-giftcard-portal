import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { BrandHeader } from "./BrandHeader";

describe("BrandHeader", () => {
  it("links the brand mark to the portal starting page", () => {
    render(
      <MemoryRouter initialEntries={["/cards"]}>
        <BrandHeader />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Go to portal home" }),
    ).toHaveAttribute("href", "/");
  });
});
