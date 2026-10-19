import { useForm } from "react-hook-form";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../axios-client";
import { useStateContext } from "../contexts/ContextProvider";

export default function Signup() {
  const { register, handleSubmit, getValues, formState: { errors: formErrors } } = useForm({ defaultValues: {"name": "", "email": "", "password": "", "password_confirmation": ""} });



  const [errors, setErrors] = useState(null);
  const [loading, setLoading] = useState(false);

  const { setUser, setToken } = useStateContext();

  const onSubmit = (form_data) => {

    const payload = {
      name: form_data.name,
      email: form_data.email,
      password: form_data.password,
      password_confirmation: form_data.password_confirmation,
    };

    setErrors(null);
    setLoading(true);

    axiosClient
      .post("/signup", payload)
      .then(({ data }) => {
        setUser(data.user);
        setToken(data.token);
      })
      .catch((err) => {
        const response = err.response;
        if (response && response.status === 422) {
          setErrors(response.data.errors);
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <div className="auth-form-heading">
        <span className="eyebrow">INTELLIRIDE WORKSPACE</span>
        <h1>Create an account.</h1>
        <p>Set up your access to the workspace.</p>
      </div>
      {errors && (
        <div role="alert" className="form-alert">
          {Object.keys(errors).map((key) => (
            <p key={key}>{errors[key][0]}</p>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <label htmlFor="signup-name" className="field-label">
            Full name
          </label>
          <Input
            id="signup-name"
            {...register("name", { required: "This field is required." })} error={errors?.name?.[0] || formErrors.name?.message}
            type="text"
            autoComplete="name"
            placeholder="Your full name"
            required
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="field-label">
            Email address
          </label>
          <Input
            id="signup-email"
            {...register("email", { required: "Enter your email address.", pattern: { value: /^[^\s@]+@[^\s@]+$/, message: "Enter a valid email address." } })} error={errors?.email?.[0] || formErrors.email?.message}
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="signup-password" className="field-label">
              Password
            </label>
            <Input
              id="signup-password"
              {...register("password", { required: "This field is required." })} error={errors?.password?.[0] || formErrors.password?.message}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label htmlFor="signup-confirm" className="field-label">
              Confirm password
            </label>
            <Input
              id="signup-confirm"
              {...register("password_confirmation", { required: "Confirm your password.", validate: value => value === getValues("password") || "Passwords do not match." })} error={errors?.password_confirmation?.[0] || formErrors.password_confirmation?.message}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading && <LoaderCircle className="animate-spin" />}
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="auth-help">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
