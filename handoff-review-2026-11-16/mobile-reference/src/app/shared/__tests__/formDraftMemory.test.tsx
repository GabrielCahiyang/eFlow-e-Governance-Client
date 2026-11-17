import { beforeEach, expect, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text, TextInput } from "react-native";
import { clearDisplayCache } from "../displayCache";
import {
  clearAllFormDrafts,
  clearFormDraft,
  clearFormDraftPrefix,
  formDraftKey,
  readFormDraft,
  useRetainedDraft,
  writeFormDraft,
} from "../formDraftMemory";

beforeEach(() => {
  clearAllFormDrafts();
});

test("formDraftMemory scopes keys by actor and clears by key, prefix, or identity change", () => {
  const k1 = formDraftKey("user-a", "cash-request:task-1");
  const k2 = formDraftKey("user-a", "cash-request:task-2");
  const k3 = formDraftKey("user-b", "cash-request:task-1");

  expect(k1).not.toBe(k3);
  expect(formDraftKey(null, "scope")).toBe("anon:scope");

  writeFormDraft(k1, { amount: "500" });
  writeFormDraft(k2, { amount: "900" });
  writeFormDraft(k3, { amount: "1200" });

  expect(readFormDraft<{ amount: string }>(k1)).toEqual({ amount: "500" });

  clearDisplayCache("data");
  clearDisplayCache("access");
  expect(readFormDraft<{ amount: string }>(k1)).toEqual({ amount: "500" });

  clearFormDraft(k1);
  expect(readFormDraft(k1)).toBeUndefined();
  expect(readFormDraft<{ amount: string }>(k2)).toEqual({ amount: "900" });

  clearFormDraftPrefix("user-a:");
  expect(readFormDraft(k2)).toBeUndefined();
  expect(readFormDraft<{ amount: string }>(k3)).toEqual({ amount: "1200" });

  clearDisplayCache("identity");
  expect(readFormDraft(k3)).toBeUndefined();
});

function DraftHarness({
  draftKey,
  active = true,
  initialValue = "",
  restoreOnOpen = true,
}: {
  draftKey: string;
  active?: boolean;
  initialValue?: string;
  restoreOnOpen?: boolean;
}) {
  const [draft, update, clear] = useRetainedDraft(draftKey, active, () => ({
    note: initialValue,
  }), { restoreOnOpen });
  return (
    <>
      <TextInput
        accessibilityLabel="Draft note"
        value={draft.note}
        onChangeText={(note) => update({ note })}
      />
      <Text testID="current-note">{draft.note}</Text>
      <Pressable accessibilityRole="button" onPress={clear}>
        <Text>Clear draft</Text>
      </Pressable>
    </>
  );
}

test("useRetainedDraft preserves edits across unmount/remount, avoids idle writes, and clears on save", async () => {
  const key = formDraftKey("actor-1", "demo-form");

  // Untouched mount does not pollute draft memory.
  const first = await render(<DraftHarness draftKey={key} initialValue="init" />);
  expect(readFormDraft(key)).toBeUndefined();

  await fireEvent.changeText(screen.getByLabelText("Draft note"), "Keep me");
  expect(readFormDraft<{ note: string }>(key)).toEqual({ note: "Keep me" });
  await first.unmount();

  // Reopening restores the retained draft instead of initialValue.
  const second = await render(<DraftHarness draftKey={key} initialValue="init" />);
  expect(screen.getByLabelText("Draft note").props.value).toBe("Keep me");

  await fireEvent.press(screen.getByRole("button", { name: "Clear draft" }));
  expect(readFormDraft(key)).toBeUndefined();
  expect(screen.getByTestId("current-note")).toHaveTextContent("init");
  await second.unmount();
});

test("useRetainedDraft does not persist edits when inactive", async () => {
  const key = formDraftKey("actor-1", "inactive-form");
  await render(<DraftHarness draftKey={key} active={false} />);
  await fireEvent.changeText(screen.getByLabelText("Draft note"), "Read only");
  expect(readFormDraft(key)).toBeUndefined();
});


test("ordinary edit reopening ignores an old typed draft and keeps failures in the current form", async () => {
 const key=formDraftKey("actor","edit:task");writeFormDraft(key,{note:"Yesterday's unsaved draft"});
 const first=await render(<DraftHarness draftKey={key} initialValue="Saved server value" restoreOnOpen={false} />);
 expect(screen.getByLabelText("Draft note").props.value).toBe("Saved server value");
 await fireEvent.changeText(screen.getByLabelText("Draft note"),"Current attempted edit");
 await first.rerender(<DraftHarness draftKey={key} initialValue="Saved server value" restoreOnOpen={false} />);
 expect(screen.getByLabelText("Draft note").props.value).toBe("Current attempted edit");
 await first.unmount();
 await render(<DraftHarness draftKey={key} initialValue="New saved value" restoreOnOpen={false} />);
 expect(screen.getByLabelText("Draft note").props.value).toBe("New saved value");
});
