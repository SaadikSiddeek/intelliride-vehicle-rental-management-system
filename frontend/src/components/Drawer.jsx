import { X, Save, LoaderCircle } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
export default function CustomDrawer({
  open,
  setOpen,
  title,
  description,
  children,
  onSubmit,
  submitText = "Save",
  saving = false,
  size = "max-w-2xl",
}) {
  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection="right">
      <DrawerContent className={`form-drawer ${size}`}>
        <DrawerHeader className="form-drawer-header">
          <div>
            <p className="eyebrow">WORKSPACE / RECORD DETAILS</p>
            <DrawerTitle className="text-xl font-semibold">{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </div>
          <DrawerClose
            render={
              <Button variant="ghost" size="icon" aria-label="Close form">
                <X />
              </Button>
            }
          />
        </DrawerHeader>
        <div className="form-drawer-body">{children}</div>
        <DrawerFooter className="form-drawer-footer">
          <DrawerClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={onSubmit} disabled={saving} aria-busy={saving}>
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
            {submitText}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
