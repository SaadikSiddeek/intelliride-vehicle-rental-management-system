import { useForm } from "react-hook-form";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoaderCircle, ArrowRight, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStateContext } from "../contexts/ContextProvider";
import axiosClient from "../axios-client";

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm({ defaultValues: { email: "", password: "" } });

  const [errors, setErrors] = useState(null);
  const [loading, setLoading] = useState(false);
  const { setUser, setToken, sessionExpired } = useStateContext();

  const onSubmit = (form_data) => {
    const payload = {
      email: form_data.email,
      password: form_data.password,
    };

    setErrors(null);
    setLoading(true);

    axiosClient
      .post("/login", payload)
      .then(({ data }) => {
        setUser(data.user);
        setToken(data.token);
      })
      .catch((err) => {
        const response = err.response;

        if (response && response.status === 422) {
          if (response.data.errors) {
            setErrors(response.data.errors);
          } else {
            setErrors({ email: [response.data.message] });
          }
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <div className="auth-form-heading">
        <span className="eyebrow">WELCOME TO INTELLIRIDE</span>
        <h1>Welcome back.</h1>
        <p>Enter your details to open your workspace.</p>
      </div>

      {sessionExpired && (
        <div role="status" className="form-alert">
          Your session has ended. Please sign in again.
        </div>
      )}

      {errors && (
        <div role="alert" className="form-alert">
          {Object.keys(errors).map((key) => (
            <p key={key}>{errors[key][0]}</p>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <label htmlFor="login-email" className="field-label">
            Email address
          </label>
          <Input
            id="login-email"
            {...register("email", {
              required: "Enter your email address.",
              pattern: {
                value: /^[^\s@]+@[^\s@]+$/,
                message: "Enter a valid email address.",
              },
            })}
            error={errors?.email?.[0] || formErrors.email?.message}
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            required
          />
        </div>
        <div>
          <label htmlFor="login-password" className="field-label">
            Password
          </label>
          <Input
            id="login-password"
            {...register("password", { required: "This field is required." })}
            error={errors?.password?.[0] || formErrors.password?.message}
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11">
          {loading && <LoaderCircle className="animate-spin" />}
          {loading ? "Signing in..." : "Sign in to workspace"}
          {!loading && <ArrowRight />}
        </Button>
      </form>
      <p className="auth-help">
        <LockKeyhole size={14} /> Sign in with your organization account.
      </p>
      <p className="auth-join">
        New to IntelliRide?{" "}
        <Link to="/signup">
          Create an account <ArrowRight size={14} />
        </Link>
      </p>
    </div>
  );
}
