import { useEffect, useState } from "react";
import { fetchConToken } from "../auth";

export default function AdminPanel() {
  const [usuarios, setUsuarios] = useState([]);
  const [rolesEdit, setRolesEdit] = useState({});
  const [resetPasswords, setResetPasswords] = useState({});
  const [mostrarPasswordReset, setMostrarPasswordReset] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [errorForm, setErrorForm] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState({});

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios`);
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
        const rolesIniciales = {};
        data.forEach((u) => {
          rolesIniciales[u.username] = u.rol;
        });
        setRolesEdit(rolesIniciales);
      } else {
        console.error("Error al obtener usuarios");
      }
    } catch (err) {
      console.error("Fallo al cargar usuarios:", err);
    }
  };

  const marcarCargando = (username, estado) => {
    setLoadingUsuarios((prev) => ({ ...prev, [username]: estado }));
  };

  const activarUsuario = async (username) => {
    if (loadingUsuarios[username]) return;
    marcarCargando(username, true);
    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios/${username}/activar`, { method: "PUT" });
    marcarCargando(username, false);
    if (res.ok) cargarUsuarios();
    else alert("Error al activar usuario");
  };

  const suspenderUsuario = async (username) => {
    if (loadingUsuarios[username]) return;
    marcarCargando(username, true);
    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios/${username}/suspender`, { method: "PUT" });
    marcarCargando(username, false);
    if (res.ok) cargarUsuarios();
    else alert("Error al suspender usuario");
  };

  const eliminarUsuario = async (username) => {
    if (!confirm(`¿Seguro que querés eliminar al usuario ${username}?`)) return;
    if (loadingUsuarios[username]) return;
    marcarCargando(username, true);
    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios/${username}`, { method: "DELETE" });
    marcarCargando(username, false);
    if (res.ok) cargarUsuarios();
    else alert("Error al eliminar usuario");
  };

  const actualizarRol = async (username) => {
    if (loadingUsuarios[username]) return;
    marcarCargando(username, true);
    const formData = new FormData();
    formData.append("rol", rolesEdit[username]);

    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios/${username}/rol`, {
      method: "PUT",
      body: formData,
    });

    marcarCargando(username, false);
    if (res.ok) {
      setMensaje(`✅ Rol actualizado para ${username}`);
      cargarUsuarios();
    } else {
      setMensaje(`❌ Error al actualizar rol`);
    }
  };

  const generarPassword = () => {
    const random = Math.random().toString(36).slice(-5);
    return `Frio${random.charAt(0).toUpperCase()}${random.slice(1)}!`;
  };

  const resetearPassword = async (username) => {
    if (loadingUsuarios[username]) return;
    const nueva = resetPasswords[username];
    if (!nueva || nueva.length < 4) {
      alert("Ingresá una contraseña válida.");
      return;
    }

    marcarCargando(username, true);
    const formData = new FormData();
    formData.append("new_password", nueva);

    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios/${username}/reset_password`, {
      method: "PUT",
      body: formData,
    });

    marcarCargando(username, false);
    if (res.ok) {
      setMensaje(`✅ Contraseña reseteada para ${username}`);
      setResetPasswords((prev) => ({ ...prev, [username]: "" }));
    } else {
      alert("Error al resetear contraseña");
    }
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    const form = e.target;
    const username = form.username.value.trim();
    const password = form.password.value.trim();
    const rol = form.rol.value;
    const activo = form.activo.value;

    setMensaje("");
    setErrorForm("");

    if (!username || !password) {
      setErrorForm("Todos los campos son obligatorios.");
      return;
    }

    if (usuarios.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      setErrorForm(`❌ El usuario "${username}" ya existe.`);
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    formData.append("rol", rol);
    formData.append("activo", activo);

    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios`, {
      method: "POST",
      body: formData,
    });

    setLoading(false);
    if (res.ok) {
      setMensaje("✅ Usuario creado con éxito");
      form.reset();
      cargarUsuarios();
    } else {
      const text = await res.text();
      setErrorForm(`❌ Error al crear usuario: ${text}`);
    }

    setTimeout(() => setMensaje(""), 4000);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Panel de Administración</h2>

      <div className="bg-white border p-4 mb-6 rounded shadow-md">
        <h3 className="text-lg font-semibold mb-2">Crear nuevo usuario</h3>
        <form onSubmit={handleCrearUsuario} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
          <input name="username" placeholder="Nombre de usuario" className="border px-2 py-1 rounded" />
          <input name="password" type="password" placeholder="Contraseña" className="border px-2 py-1 rounded" />
          <select name="rol" defaultValue="usuario" className="border px-2 py-1 rounded">
            <option value="usuario">usuario</option>
            <option value="admin">admin</option>
          </select>
          <select name="activo" defaultValue="1" className="border px-2 py-1 rounded">
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="col-span-1 sm:col-span-4 bg-blue-600 text-white rounded py-1 hover:bg-blue-700"
          >
            {loading ? "Creando..." : "Crear usuario"}
          </button>
        </form>
        {errorForm && <p className="text-red-600 mt-2">{errorForm}</p>}
        {mensaje && <p className="text-green-600 mt-2">{mensaje}</p>}
      </div>

      <table className="min-w-full border rounded text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2 text-left">Usuario</th>
            <th className="border px-4 py-2 text-left">Rol</th>
            <th className="border px-4 py-2 text-left">Estado</th>
            <th className="border px-4 py-2 text-left">Último Login</th>
            <th className="border px-4 py-2 text-left">Cambiar Rol</th>
            <th className="border px-4 py-2 text-left">Contraseña</th>
            <th className="border px-4 py-2 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.username}>
              <td className="border px-4 py-2">{u.username}</td>
              <td className="border px-4 py-2">{u.rol}</td>
              <td className="border px-4 py-2">
                <span className={`px-2 py-1 rounded text-xs ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {u.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="border px-4 py-2">{u.last_login || "—"}</td>
              <td className="border px-4 py-2">
                <select
                  value={rolesEdit[u.username] || u.rol}
                  onChange={(e) => setRolesEdit((prev) => ({ ...prev, [u.username]: e.target.value }))}
                  className="border p-1 rounded"
                >
                  <option value="admin">admin</option>
                  <option value="usuario">usuario</option>
                </select>
                <button
                  disabled={loadingUsuarios[u.username]}
                  onClick={() => actualizarRol(u.username)}
                  className="bg-green-600 text-white px-2 py-1 rounded ml-2 hover:bg-green-700"
                >
                  Actualizar
                </button>
              </td>
              <td className="border px-4 py-2">
                <div className="flex flex-col sm:flex-row gap-1">
                  <input
                    type={mostrarPasswordReset ? "text" : "password"}
                    placeholder="Nueva contraseña"
                    value={resetPasswords[u.username] || ""}
                    onChange={(e) => setResetPasswords((prev) => ({ ...prev, [u.username]: e.target.value }))}
                    className="border rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => setResetPasswords((prev) => ({
                      ...prev,
                      [u.username]: generarPassword(),
                    }))}
                    className="bg-yellow-500 text-white px-2 rounded hover:bg-yellow-600"
                  >
                    Sugerir
                  </button>
                  <button
                    disabled={loadingUsuarios[u.username]}
                    onClick={() => resetearPassword(u.username)}
                    className="bg-purple-600 text-white px-2 rounded hover:bg-purple-700"
                  >
                    Resetear
                  </button>
                </div>
                <label className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                  <input
                    type="checkbox"
                    checked={mostrarPasswordReset}
                    onChange={() => setMostrarPasswordReset(!mostrarPasswordReset)}
                  />
                  Mostrar contraseñas
                </label>
              </td>
              <td className="border px-4 py-2">
                {u.activo ? (
                  <button
                    disabled={loadingUsuarios[u.username]}
                    onClick={() => suspenderUsuario(u.username)}
                    className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 mr-2"
                  >
                    Suspender
                  </button>
                ) : (
                  <button
                    disabled={loadingUsuarios[u.username]}
                    onClick={() => activarUsuario(u.username)}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 mr-2"
                  >
                    Activar
                  </button>
                )}
                <button
                  disabled={loadingUsuarios[u.username]}
                  onClick={() => eliminarUsuario(u.username)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
