let token = localStorage.getItem("treeLootAdminToken") || "";

const $ = (id) => document.getElementById(id);
const el = {
  loginPanel: $("loginPanel"), adminPanel: $("adminPanel"), username: $("usernameInput"), password: $("passwordInput"), login: $("loginButton"), message: $("messageText"), refresh: $("refreshButton"), table: $("userTable")
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.log || "请求失败");
  return data;
}

async function login() {
  try {
    const data = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ username: el.username.value.trim(), password: el.password.value }) });
    token = data.token;
    localStorage.setItem("treeLootAdminToken", token);
    el.loginPanel.style.display = "none";
    el.adminPanel.style.display = "block";
    await loadUsers();
  } catch (error) {
    el.message.textContent = error.message;
  }
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  el.table.innerHTML = data.users.map((user) => `
    <tr>
      <td>${user.id}</td><td>${user.username}</td><td>${user.role}</td><td>${user.playerId || "-"}</td><td>${user.level || "-"}</td><td>${user.floor || "-"}</td><td>${user.power || "-"}</td><td>${user.gold || "-"}</td>
      <td><button onclick="resetPassword(${user.id})">重置密码</button><button class="danger" onclick="deleteUser(${user.id})" ${user.role === "admin" ? "disabled" : ""}>删除</button></td>
    </tr>`).join("");
}

async function resetPassword(id) {
  const password = prompt("输入新密码（至少 6 位）");
  if (!password) return;
  await api(`/api/admin/users/${id}/password`, { method: "POST", body: JSON.stringify({ password }) });
  alert("密码已重置");
}

async function deleteUser(id) {
  if (!confirm("确认删除这个用户？")) return;
  await api(`/api/admin/users/${id}`, { method: "DELETE" });
  await loadUsers();
}

el.login.addEventListener("click", login);
el.refresh.addEventListener("click", loadUsers);

if (token) {
  el.loginPanel.style.display = "none";
  el.adminPanel.style.display = "block";
  loadUsers().catch(() => {
    token = "";
    localStorage.removeItem("treeLootAdminToken");
    el.loginPanel.style.display = "block";
    el.adminPanel.style.display = "none";
  });
}
