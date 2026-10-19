import FieldError from "@/components/ErrorField";
import { TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function DesignationForm({
  register,
  errors,
  generalError,
  onSubmit,
}) {

  return (
    <>
      {generalError && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-[var(--danger-soft)] px-4 py-3">
          <TriangleAlert
            size={16}
            aria-hidden="true"
            className="text-red-500 mt-0.5"
          />
          <p className="text-sm text-destructive font-medium">{generalError}</p>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-5">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Designation Name
            </label>

            <div className="flex items-start gap-4">
              <div className="flex-1">
                <Input
                  aria-label="Designation name"
                  type="text"
                  placeholder="Enter designation name"
                  className={`custom-input-sm w-full ${errors.designation_name ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
                  aria-invalid={!!errors.designation_name} aria-describedby={errors.designation_name ? "designation_name-error" : undefined}
                      {...register("designation_name", {
                    required: "Designation name is required",
                  })}
                />
                <FieldError errors={errors} name="designation_name" />
              </div>

              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                <Input
                  aria-label="Status"
                  type="checkbox"
                  className="sr-only peer"
                  {...register("status")}
                />
                <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-primary transition-colors"></div>
                <div className="absolute left-1 top-1 h-4 w-4 bg-card rounded-full transition-transform peer-checked:translate-x-5"></div>
              </label>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
