// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "../../src/app/components/ui/button";
import { FormField, SelectInput, TextInput } from "../../src/app/components/ui/FormField";
import { DataTable } from "../../src/app/components/ui/DataTable";
import { useConfirmation } from "../../src/app/components/ui/useConfirmation";
import { FeatureDialog } from "../../src/app/components/ui/FeatureDialog";

afterEach(cleanup);
describe("design foundation compatibility contracts", () => {
  it("keeps compound controls' explicit IDs on the control rather than its wrapper", () => {
    render(<FormField label="Compound field" controlId="compound" error="Required"><div><input id="compound" aria-describedby="compound-error" /></div></FormField>);
    expect(screen.getByRole("textbox",{name:"Compound field"})).toBeTruthy();
    expect(document.querySelectorAll("#compound").length).toBe(1);
  });
  it("associates labels, descriptions and errors without removing a supplied description", () => {
    const view = render(<FormField label="Email" required description="Your work address" error="Required"><TextInput aria-describedby="existing-help" /></FormField>);
    const input = screen.getByRole("textbox", { name:"Email" });
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain("existing-help");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(screen.getByRole("alert").id);
    view.rerender(<FormField label="Office" controlId="office" description="Eligible offices"><SelectInput options={[{value:"1",label:"Planning"}]} /></FormField>);
    expect(screen.getByLabelText("Office").id).toBe("office");
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("blocks pending button activation and exposes its disabled explanation", () => {
    const save = vi.fn();
    render(<Button pending disabledReason="Saving your changes" onClick={save}>Save</Button>);
    const button = screen.getByRole("button", {name:"Save"});
    fireEvent.click(button);
    expect(save).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe("Saving your changes");
  });
  it("blocks disabled link activation and names icon controls", () => {
    const click = vi.fn();
    render(<><Button asChild disabled onClick={click}><a href="#unsafe">Unavailable action</a></Button><IconButton label="Open actions">…</IconButton></>);
    fireEvent.click(screen.getByRole("link"));
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByRole("button", {name:"Open actions"})).toBeTruthy();
  });
  it("renders toolbar without search, retries errors and keeps action keys out of row activation", () => {
    const row = vi.fn(), action = vi.fn(), retry = vi.fn();
    const props = {data:[{id:"1"}],columns:[{key:"action",header:"Actions",action:true,render:() => <button onClick={action}>Inspect</button>}],keyExtractor:(item:{id:string})=>item.id,onRowClick:row,toolbar:<button>Filter</button>};
    const view = render(<DataTable {...props} density="compact" />);
    expect(screen.getByRole("button", {name:"Filter"})).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", {name:"Inspect"}), {key:"Enter"});
    fireEvent.click(screen.getByRole("button", {name:"Inspect"}));
    expect(row).not.toHaveBeenCalled(); expect(action).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByLabelText("Open record"),{key:"Enter"}); expect(row).toHaveBeenCalledOnce();
    view.rerender(<DataTable {...props} error="Network unavailable" onRetry={retry} />);
    expect(screen.getByRole("alert").textContent).toContain("Network unavailable");
    fireEvent.click(screen.getByRole("button", {name:"Retry"})); expect(retry).toHaveBeenCalledOnce();
  });
  it("cancels without mutation and requires an exact phrase or resolved blockers", async () => {
    const mutate = vi.fn();
    function Fixture({blocked = false}) {
      const {confirm,dialog} = useConfirmation();
      return <><button onClick={async () => {if(await confirm({title:"Delete record",description:"Permanent removal",confirmationText:"DELETE",blockers:blocked?["Linked to audit history"]:[],impact:<p>One record is affected.</p>})) mutate();}}>Request deletion</button>{dialog}</>;
    }
    const view = render(<Fixture />);
    fireEvent.click(screen.getByText("Request deletion"));
    const confirm = screen.getByRole("button",{name:"Confirm"});
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"),{target:{value:"DELETE"}});
    fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
    await Promise.resolve(); expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Request deletion"));
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"),{target:{value:"DELETE"}});
    fireEvent.click(screen.getByRole("button",{name:"Confirm"}));
    await Promise.resolve(); expect(mutate).toHaveBeenCalledOnce();
    view.rerender(<Fixture blocked />);fireEvent.click(screen.getByText("Request deletion"));
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"),{target:{value:"DELETE"}});
    expect(screen.getByRole("button",{name:"Confirm"}).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Linked to audit history")).toBeTruthy();
  });
  it("keeps a pending feature dialog open on Escape", () => {
    const close = vi.fn();
    render(<FeatureDialog title="Saving draft" onClose={close} preventClose><button>Save</button></FeatureDialog>);
    fireEvent.keyDown(screen.getByRole("dialog"),{key:"Escape"});
    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByRole("button",{name:"Close"})).toBeNull();
  });
});
