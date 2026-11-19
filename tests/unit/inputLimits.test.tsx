// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateInput } from "../../src/app/components/ui/DateInput";
import { FieldLengthHint } from "../../src/app/components/ui/FieldLengthHint";
import { TextInput } from "../../src/app/components/ui/FormField";
import { Input } from "../../src/app/components/ui/input";
import { MoneyInput } from "../../src/app/components/ui/MoneyInput";
import { Textarea } from "../../src/app/components/ui/textarea";
import {
  blockInvalidNumberKey,
  defaultMaxLengthForInputType,
  INPUT_LIMITS,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
  textLengthError,
} from "../../src/app/shared/inputLimits";
import { moneyMaxFormattedLength, moneyMaxIntegerDigits, parseMoneyInput } from "../../src/app/shared/moneyInput";

afterEach(() => {
  cleanup();
});

function MoneyMaxHarness({ max = INPUT_LIMITS.MONEY_MAX_BUDGET }: { max?: number }) {
  const [value, setValue] = useState("");
  return (
    <MoneyInput
      aria-label="Budget Amount"
      value={value}
      max={max}
      onValueChange={setValue}
    />
  );
}

describe("Slice A shared input limits & MoneyInput formatting", () => {
  it("formats money with commas every 3 digits and blocks typing past the max digit ceiling", () => {
    render(<MoneyMaxHarness max={1_000_000} />);
    const input = screen.getByLabelText("Budget Amount") as HTMLInputElement;
    expect(input.maxLength).toBe(moneyMaxFormattedLength(1_000_000));
    expect(input.className).toContain("tabular-nums");

    fireEvent.change(input, { target: { value: "1000000" } });
    expect(input.value).toBe("1,000,000");

    // 8 integer digits exceeds the 7-digit ceiling for max=1,000,000 and is ignored
    fireEvent.change(input, { target: { value: "10000000" } });
    expect(input.value).toBe("1,000,000");

    // Decimals remain accepted within the ceiling
    fireEvent.change(input, { target: { value: "123456.78" } });
    expect(input.value).toBe("123,456.78");
  });

  it("caps parseMoneyInput integer digits accurately", () => {
    expect(moneyMaxIntegerDigits(90_000_000_000)).toBe(11);
    expect(parseMoneyInput("90,000,000,000.99", 11)).toBe("90000000000.99");
    expect(parseMoneyInput("900,000,000,000", 11)).toBeNull();
  });

  it("blocks invalid scientific/sign/decimal keys via blockInvalidNumberKey", () => {
    const makeEvent = (key: string) => {
      const preventDefault = vi.fn();
      return { key, preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>;
    };

    for (const key of ["e", "E", "+", "-", "."]) {
      const ev = makeEvent(key);
      blockInvalidNumberKey(ev);
      expect(ev.preventDefault).toHaveBeenCalledOnce();
    }

    const decimalAllowed = makeEvent(".");
    blockInvalidNumberKey(decimalAllowed, { allowDecimal: true });
    expect(decimalAllowed.preventDefault).not.toHaveBeenCalled();

    const negativeAllowed = makeEvent("-");
    blockInvalidNumberKey(negativeAllowed, { allowNegative: true });
    expect(negativeAllowed.preventDefault).not.toHaveBeenCalled();
  });

  it("sanitizes integer and decimal input strings against max digits", () => {
    expect(sanitizeIntegerInput("0045", 99)).toBe("45");
    expect(sanitizeIntegerInput("100", 99)).toBeNull();
    expect(sanitizeIntegerInput("abc", 99)).toBeNull();
    expect(sanitizeIntegerInput("", 99)).toBe("");

    expect(sanitizeDecimalInput("12.34", 99, 2)).toBe("12.34");
    expect(sanitizeDecimalInput("12.345", 99, 2)).toBeNull();
    expect(sanitizeDecimalInput("100.00", 99, 2)).toBeNull();
    expect(sanitizeDecimalInput(".5", 99, 2)).toBe("0.5");
  });

  it("applies default maxLength bounds across UI primitives while honoring overrides", () => {
    expect(defaultMaxLengthForInputType("email")).toBe(INPUT_LIMITS.EMAIL);
    expect(defaultMaxLengthForInputType("password")).toBe(INPUT_LIMITS.PASSWORD);
    expect(defaultMaxLengthForInputType("search")).toBe(INPUT_LIMITS.SEARCH);
    expect(defaultMaxLengthForInputType("text")).toBe(INPUT_LIMITS.TAGS_LIST);
    expect(defaultMaxLengthForInputType("checkbox")).toBeUndefined();
    expect(defaultMaxLengthForInputType("number")).toBeUndefined();

    render(
      <div>
        <DateInput aria-label="Due date" value="" />
        <Input aria-label="Default input" />
        <Input aria-label="Email input" type="email" />
        <Input aria-label="Custom input" maxLength={42} />
        <Textarea aria-label="Default textarea" />
        <TextInput aria-label="Form text input" />
      </div>,
    );

    expect((screen.getByLabelText("Due date") as HTMLInputElement).maxLength).toBe(INPUT_LIMITS.DATE_TEXT_MAX);
    expect((screen.getByLabelText("Default input") as HTMLInputElement).maxLength).toBe(INPUT_LIMITS.TAGS_LIST);
    expect((screen.getByLabelText("Email input") as HTMLInputElement).maxLength).toBe(INPUT_LIMITS.EMAIL);
    expect((screen.getByLabelText("Custom input") as HTMLInputElement).maxLength).toBe(42);
    expect((screen.getByLabelText("Default textarea") as HTMLTextAreaElement).maxLength).toBe(INPUT_LIMITS.DESCRIPTION);
    expect((screen.getByLabelText("Form text input") as HTMLInputElement).maxLength).toBe(INPUT_LIMITS.TAGS_LIST);
  });

  it("renders FieldLengthHint only near/at limit unless alwaysShow is enabled", () => {
    const { rerender } = render(<FieldLengthHint length={50} max={200} />);
    expect(screen.queryByText(/200/)).not.toBeInTheDocument();

    rerender(<FieldLengthHint length={160} max={200} />);
    expect(screen.getByText("160 / 200")).toHaveClass("text-neutral-400");

    rerender(<FieldLengthHint length={185} max={200} />);
    expect(screen.getByText("185 / 200")).toHaveClass("text-amber-600");

    rerender(<FieldLengthHint length={200} max={200} />);
    expect(screen.getByText("200 / 200")).toHaveClass("text-red-600");

    rerender(<FieldLengthHint length={0} max={200} alwaysShow />);
    expect(screen.getByText("0 / 200")).toBeInTheDocument();

    expect(textLengthError("   ", "Title", { max: 200, required: true })).toContain("required");
    expect(textLengthError("ab", "Title", { min: 3, max: 200 })).toContain("at least 3");
    expect(textLengthError("x".repeat(201), "Title", { max: 200 })).toContain("at most 200");
  });
});
