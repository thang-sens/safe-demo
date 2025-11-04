import { useState } from "react";
import { login, getAddress } from "../lib/web3auth";

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await login();
      const addr = await getAddress();
      setAddress(addr);
      onLogin();
    } catch (error) {
      console.error("Login failed", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      {!address ? (
        <button onClick={handleLogin} disabled={isLoggingIn}>
          {isLoggingIn ? "Logging in..." : "Login with Web3Auth"}
        </button>
      ) : (
        <p>Logged in as: {address}</p>
      )}
    </div>
  );
};

export default Login;
