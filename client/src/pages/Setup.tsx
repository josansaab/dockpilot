import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Ship, Check } from "lucide-react";

interface SetupProps {
  onSuccess: () => void;
}

export default function Setup({ onSuccess }: SetupProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Setup failed");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card/40 backdrop-blur-xl border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Ship className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Welcome to DockPilot</CardTitle>
            <CardDescription className="text-muted-foreground">
              Create your admin account to get started
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                data-testid="input-setup-username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="input-setup-password"
                type="password"
                placeholder="Create a password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                data-testid="input-setup-confirm-password"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {password && confirmPassword && password === confirmPassword && (
                <div className="flex items-center text-green-500 text-sm">
                  <Check className="w-4 h-4 mr-1" />
                  Passwords match
                </div>
              )}
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm" data-testid="text-setup-error">
                {error}
              </div>
            )}
            <Button
              type="submit"
              data-testid="button-create-account"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
          <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border/50">
            <h4 className="font-medium text-sm mb-2">What you'll get:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-green-500" />
                Manage Docker containers
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-green-500" />
                One-click app installation
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 mr-2 text-green-500" />
                Beautiful dashboard interface
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
