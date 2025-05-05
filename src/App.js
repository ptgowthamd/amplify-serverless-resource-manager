import React, { useState } from "react";
import "./App.css";
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports";
import {
  useAuthenticator,
  Authenticator,
  CheckboxField,
} from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { useWebSocket } from "./hooks/useWebsocket";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


Amplify.configure(awsExports);

export default function App() {
  // State for fetching VPC details
  const [vpcName, setVpcName] = useState("");
  const [apiResponse, setApiResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  // State for toggling the Create VPC form
  const [showCreateForm, setShowCreateForm] = useState(false);
  // State for the "Create VPC" form data, including a dynamic list of subnets
  const [newVpcData, setNewVpcData] = useState({
    vpcName: "",
    region: "",
    cidr: "",
    subnets: [{ subnetName: "", cidr: "", availabilityZone: "" }],
  });
  const [createResponse, setCreateResponse] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // whenever the socket pushes you data, this callback runs
  const handleIncoming = (data) => {
    // e.g. { action: 'newMessage', message: { text: '…' } }
    if (data.action === "newMessage") {
      const { text } = data.message;
      const { sender } = data;
      setMessages((msgs) => [...msgs, { text, sender }]);

       // new: toast any system message
      // NEW: toast for system announcements (10 s)
      if (sender === "system") {
          toast.info(text, { autoClose: 10_000, pauseOnHover: true });
      }
    }
  };

  // Delay socket init until after login
  const { user } = useAuthenticator((context) => [context.user]);
  const { sendMessage } = useWebSocket(handleIncoming);

  const handleSend = () => {
    if (!input.trim()) return;
    // strip off the domain, if you want just the local-part:
    const sender = user.signInDetails.loginId.split("@")[0];
    sendMessage({
      action: "sendMessage",
      data: { text: input },
      sender: sender,
    });
    setInput("");
  };

  // New: toggle for chat window
  const [chatOpen, setChatOpen] = useState(true);

  // constants for dimensions
  const CHAT_WIDTH = 300;
  const CHAT_HEADER_HEIGHT = 40;
  const CHAT_OPEN_HEIGHT = 400;

  // Utility: Dynamically build localStorage key and retrieve the ID token.
  function getIdToken() {
    const clientId = awsExports.aws_user_pools_web_client_id;
    const lastAuthUser = localStorage.getItem(
      `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`
    );
    if (!lastAuthUser) {
      throw new Error("No authenticated user found in localStorage.");
    }
    const idToken = localStorage.getItem(
      `CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`
    );
    if (!idToken) {
      throw new Error(
        "No ID token found in localStorage. Make sure you are signed in."
      );
    }
    return idToken;
  }

  // GET API call to fetch VPC details.
  async function fetchVpcDetails() {
    try {
      setLoading(true);
      const idToken = getIdToken();
      const url = `https://yi0vrfvvr5.execute-api.ap-south-1.amazonaws.com/stagging/vpc/${vpcName}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: idToken,
        },
      });
      const data = await response.json();
      setApiResponse(data);
    } catch (error) {
      console.error("Error fetching VPC details:", error);
      setApiResponse({ error: error.message || "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  // POST API call to create a new VPC.
  async function createVpc() {
    try {
      setCreateLoading(true);
      const idToken = getIdToken();
      const url = `https://yi0vrfvvr5.execute-api.ap-south-1.amazonaws.com/stagging/vpc`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: idToken,
        },
        body: JSON.stringify(newVpcData),
      });
      const data = await response.json();
      setCreateResponse(data);
    } catch (error) {
      console.error("Error creating VPC:", error);
      setCreateResponse({ error: error.message || "Creation request failed" });
    } finally {
      setCreateLoading(false);
    }
  }

  // Handle change for the Create VPC form fields.
  function handleNewVpcChange(e) {
    const { name, value } = e.target;
    setNewVpcData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // Handle change for each subnet field.
  function handleSubnetChange(index, e) {
    const { name, value } = e.target;
    const updatedSubnets = [...newVpcData.subnets];
    updatedSubnets[index] = {
      ...updatedSubnets[index],
      [name]: value,
    };
    setNewVpcData((prev) => ({ ...prev, subnets: updatedSubnets }));
  }

  // Add a new empty subnet input group.
  function addSubnet() {
    setNewVpcData((prev) => ({
      ...prev,
      subnets: [
        ...prev.subnets,
        { subnetName: "", cidr: "", availabilityZone: "" },
      ],
    }));
  }

  // Remove a subnet input group.
  function removeSubnet(index) {
    setNewVpcData((prev) => ({
      ...prev,
      subnets: prev.subnets.filter((_, i) => i !== index),
    }));
  }

  // Render the API response for fetched VPC details.
  function renderApiResponse() {
    if (!apiResponse) return null;
    if (apiResponse.error) {
      return (
        <div style={{ color: "red", marginTop: "1rem" }}>
          <h3>Error:</h3>
          <p>{apiResponse.error}</p>
        </div>
      );
    }
    return (
      <div style={{ marginTop: "1rem" }}>
        <h3>{apiResponse.message}</h3>
        {apiResponse.vpc_subnets_details &&
        apiResponse.vpc_subnets_details.length > 0 ? (
          apiResponse.vpc_subnets_details.map((item, index) => (
            <div
              key={index}
              style={{
                border: "1px solid #ccc",
                margin: "1rem 0",
                padding: "1rem",
                borderRadius: "5px",
                boxShadow: "2px 2px 6px rgba(0,0,0,0.1)",
              }}
            >
              <h4>{item.vpc_name}</h4>
              <p>
                <strong>VPC ID:</strong> {item.vpc_id}
              </p>
              <p>
                <strong>VPC CIDR:</strong> {item.vpc_cidr}
              </p>
              <h5>Subnets:</h5>
              {item.subnets && item.subnets.length > 0 ? (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginBottom: "1rem",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                        Name
                      </th>
                      <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                        Subnet ID
                      </th>
                      <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                        Availability Zone
                      </th>
                      <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                        CIDR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.subnets.map((sub, i) => (
                      <tr key={i}>
                        <td
                          style={{ border: "1px solid #ddd", padding: "8px" }}
                        >
                          {sub.name || sub.subnetName}
                        </td>
                        <td
                          style={{ border: "1px solid #ddd", padding: "8px" }}
                        >
                          {sub.subnet_id || "-"}
                        </td>
                        <td
                          style={{ border: "1px solid #ddd", padding: "8px" }}
                        >
                          {sub.availability_zone || sub.availabilityZone}
                        </td>
                        <td
                          style={{ border: "1px solid #ddd", padding: "8px" }}
                        >
                          {sub.cidr}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No subnets available.</p>
              )}
            </div>
          ))
        ) : (
          <p>No VPC details available.</p>
        )}
      </div>
    );
  }

  // Render the Create VPC form.
  function renderCreateVpcForm() {
    return (
      <div
        style={{
          marginTop: "2rem",
          border: "1px solid #aaa",
          padding: "1rem",
          borderRadius: "5px",
          boxShadow: "2px 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        <h2>Create VPC</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createVpc();
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <label>VPC Name:</label>
            <input
              type="text"
              name="vpcName"
              value={newVpcData.vpcName}
              onChange={handleNewVpcChange}
              required
              style={{ marginLeft: "1rem" }}
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label>Region:</label>
            <input
              type="text"
              name="region"
              value={newVpcData.region}
              onChange={handleNewVpcChange}
              required
              style={{ marginLeft: "1rem" }}
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label>VPC CIDR:</label>
            <input
              type="text"
              name="cidr"
              value={newVpcData.cidr}
              onChange={handleNewVpcChange}
              required
              style={{ marginLeft: "1rem" }}
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <h3>Subnets:</h3>
            {newVpcData.subnets.map((subnet, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "1rem",
                  border: "1px solid #ddd",
                  padding: "0.5rem",
                  borderRadius: "3px",
                }}
              >
                <div style={{ marginBottom: "0.5rem" }}>
                  <label>Subnet Name:</label>
                  <input
                    type="text"
                    name="subnetName"
                    value={subnet.subnetName}
                    onChange={(e) => handleSubnetChange(index, e)}
                    required
                    style={{ marginLeft: "1rem" }}
                  />
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <label>Subnet CIDR:</label>
                  <input
                    type="text"
                    name="cidr"
                    value={subnet.cidr}
                    onChange={(e) => handleSubnetChange(index, e)}
                    required
                    style={{ marginLeft: "1rem" }}
                  />
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <label>Availability Zone:</label>
                  <input
                    type="text"
                    name="availabilityZone"
                    value={subnet.availabilityZone}
                    onChange={(e) => handleSubnetChange(index, e)}
                    required
                    style={{ marginLeft: "1rem" }}
                  />
                </div>
                {newVpcData.subnets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSubnet(index)}
                    style={{
                      backgroundColor: "#eee",
                      border: "none",
                      padding: "0.5rem",
                      borderRadius: "3px",
                    }}
                  >
                    Remove Subnet
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addSubnet}
              style={{
                backgroundColor: "#eee",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "3px",
              }}
            >
              + Add Subnet
            </button>
          </div>
          <div>
            <button type="submit" disabled={createLoading}>
              {createLoading ? "Creating..." : "Submit"}
            </button>
          </div>
          {createResponse && (
            <div style={{ marginTop: "1rem" }}>
              <h3>Creation Response:</h3>
              <pre>{JSON.stringify(createResponse, null, 2)}</pre>
            </div>
          )}
        </form>
      </div>
    );
  }

  return (
    <Authenticator
      initialState="signIn"
      components={{
        SignUp: {
          FormFields() {
            const { validationErrors } = useAuthenticator();
            return (
              <>
                <Authenticator.SignUp.FormFields />
                <CheckboxField
                  errorMessage={validationErrors.acknowledgement}
                  hasError={!!validationErrors.acknowledgement}
                  name="acknowledgement"
                  value="yes"
                  label="I agree with the Terms & Conditions"
                />
              </>
            );
          },
        },
      }}
      services={{
        async validateCustomSignUp(formData) {
          if (!formData.acknowledgement) {
            return {
              acknowledgement: "You must agree to the Terms & Conditions",
            };
          }
        },
      }}
    >
      {({ signOut, user }) => (
        <main style={{ padding: "1rem", position: "relative" }}>
         <ToastContainer />   {/* <-- NEW */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <h1 style={{ margin: 0 }}>Hello {user.signInDetails.loginId}</h1>
            <button onClick={signOut}>Sign out</button>
          </div>
          <section style={{ marginTop: "2rem" }}>
            <div style={{ marginBottom: "2rem" }}>
              <button onClick={() => setShowCreateForm(!showCreateForm)}>
                {showCreateForm ? "Hide Create VPC Form" : "Create VPC"}
              </button>
            </div>
            {showCreateForm ? (
              renderCreateVpcForm()
            ) : (
              <div>
                <h2>Fetch VPC Details</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    fetchVpcDetails();
                  }}
                >
                  <input
                    type="text"
                    placeholder="Enter VPC Name"
                    value={vpcName}
                    onChange={(e) => setVpcName(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={loading}>
                    {loading ? "Loading..." : "Fetch VPC Details"}
                  </button>
                </form>
                {renderApiResponse()}
              </div>
            )}
          </section>

          {/* ====== Replace this section: ====== */}
          {/* Live Chat (fixed bottom-right) */}
          <div
            style={{
              position: "fixed",
              bottom: 20,
              right: 20,
              width: CHAT_WIDTH,
              height: chatOpen ? CHAT_OPEN_HEIGHT : CHAT_HEADER_HEIGHT,
              border: "1px solid #ddd",
              borderRadius: 8,
              backgroundColor: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 1000,
            }}
          >
            {/* Header (click to toggle) */}
            <div
              onClick={() => setChatOpen((o) => !o)}
              style={{
                height: CHAT_HEADER_HEIGHT,
                lineHeight: `${CHAT_HEADER_HEIGHT}px`,
                padding: "0 12px",
                backgroundColor: "#f7f7f7",
                borderBottom: chatOpen ? "1px solid #eee" : "none",
                cursor: "pointer",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontWeight: "bold",
              }}
            >
              <span>Live Chat</span>
              <span>{chatOpen ? "▾" : "▸"}</span>
            </div>

            {/* Only render messages+input when open */}
            {chatOpen && (
              <>
                {/* Messages */}
                <div
                  style={{
                    flex: 1,
                    padding: "8px",
                    overflowY: "auto",
                    overflowX: "auto",
                  }}
                >
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {messages.map((msg, i) => (
                      <li
                        key={i}
                        style={{
                          marginBottom: "8px",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        <strong>{msg.sender || "User"}:</strong> {msg.text}
                      </li>
                    ))}
                    {messages.length === 0 && (
                      <li style={{ color: "#666" }}>No messages yet…</li>
                    )}
                  </ul>
                </div>

                {/* Input */}
                <div
                  style={{
                    borderTop: "1px solid #eee",
                    padding: "8px",
                    display: "flex",
                  }}
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Type a message…"
                    style={{
                      flex: 1,
                      marginRight: "8px",
                      padding: "4px 8px",
                      border: "1px solid #ccc",
                      borderRadius: 4,
                    }}
                  />
                  <button onClick={handleSend} style={{ padding: "4px 12px" }}>
                    Send
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ====== End Live Chat replacement ====== */}
        </main>
      )}
    </Authenticator>
  );
}
