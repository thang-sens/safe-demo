import { useState, useEffect } from "react";
import { initWeb3Auth, login, getAddress } from "../lib/web3auth";

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    initWeb3Auth();
  }, []);

  const handleLogin = async () => {
    try {
      await login();
      const addr = await getAddress();
      setAddress(addr);
      onLogin();
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      {!address ? (
        <button onClick={handleLogin}>Login with Web3Auth</button>
      ) : (
        <p>Logged in as: {address}</p>
      )}
    </div>
  );
};

export default Login;
