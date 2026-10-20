import { TriangleAlert } from "lucide-react";

import FieldError from "@/components/ErrorField";
import FormSection from "@/components/forms/FormSection";
import { Input } from "@/components/ui/input";

export default function DesignationForm({
  register,
  errors,
  generalError,
  formLoading = false,
  isBusy = false,
  onSubmit,
}) {
  return (
    <>
      {generalError && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-[var(--danger-soft)] px-4 py-3"
        >
          <TriangleAlert
            size={16}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-red-500"
          />

          <p className="text-sm text-destructive">{generalError}</p>
        </div>
      )}

      {formLoading && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Loading designation details...
        </p>
      )}

      <form onSubmit={onSubmit} aria-busy={isBusy} noValidate>
        <fieldset
          disabled={isBusy}
          className="m-0 min-w-0 space-y-6 border-0 p-0"
        >
          <FormSection
            title="Designation details"
            description="Set the designation name and active status."
          >
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="designation_name"
                  className="mb-2 block text-sm font-semibold text-foreground"
                >
                  Designation Name
                </label>

                <Input
                  id="designation_name"
                  type="text"
                  placeholder="Enter designation name"
                  className={`custom-input-sm w-full ${
                    errors.designation_name
                      ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                      : ""
                  }`}
                  aria-invalid={!!errors.designation_name}
                  {...register("designation_name", {
                    required: "Designation name is required",
                    validate: (value) =>
                      value.trim().length > 0 || "Designation name is required",
                    maxLength: {
                      value: 100,
                      message: "Maximum 100 characters",
                    },
                  })}
                />

                <FieldError errors={errors} name="designation_name" />
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label
                      htmlFor="designation_status"
                      className="block text-sm font-semibold text-foreground"
                    >
                      Active Status
                    </label>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Enable to mark this designation as active.
                    </p>
                  </div>

                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      id="designation_status"
                      type="checkbox"
                      role="switch"
                      className="peer sr-only"
                      aria-invalid={!!errors.status}
                      {...register("status")}
                    />

                    <span className="h-6 w-11 rounded-full bg-secondary transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />

                    <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-card transition-transform peer-checked:translate-x-5" />
                  </label>
                </div>

                <FieldError errors={errors} name="status" />
              </div>
            </div>
          </FormSection>
        </fieldset>
      </form>
    </>
  );
}
