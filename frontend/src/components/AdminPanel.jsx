// src/components/AdminPanel.jsx
import { useEffect, useState } from "react";
import { fetchConToken } from "../auth";

export default function AdminPanel() {
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState(false);
  const [rolesEdit, setRolesEdit] = useState({});
  const [resetPasswords, setResetPasswords] = useState({});
  const [mostrarPasswordReset, setMostrarPasswordReset] = useState(false);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsuarios(data);
          const rolesIniciales = {};
          data.forEach((u) => {
            rolesIniciales[u.username] = u.rol;
          });
          setRolesEdit(rolesIniciales);
          setError(false);
        } else {
          console.error("Respuesta inesperada:", data);
          setUsuarios([]);
          setError(true);
        }
      } else {
        setError(true);
        alert("Error al obtener usuarios");
      }
    } catch (err) {
      console.error("Fallo en la carga de usuarios:", err);
      setError(true);
    }
  };

  const activarUsuario = async (username) => {
    const res = await fetchConToken(
      `${import.meta.env.VITE_API_URL}/usuarios/${username}/activar`,
      { method: "PUT" }
    );
    if (res.ok) cargarUsuarios();
    else alert("Error al activar usuario");
  };

  const suspenderUsuario = async (username) => {
    const res = await fetchConToken(
      `${import.meta.env.VITE_API_URL}/usuarios/${username}/suspender`,
      { method: "PUT" }
    );
    if (res.ok) cargarUsuarios();
    else alert("Error al suspender usuario");
  };

  const eliminarUsuario = async (username) => {
    if (!confirm(`¿Seguro que querés eliminar al usuario ${username}?`)) return;
    const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios/${username}`, {
      method: "DELETE",
    });
    if (res.ok) cargarUsuarios();
    else alert("Error al eliminar usuario");
  };

  const actualizarRol = async (username) => {
    const nuevoRol = rolesEdit[username];
    const formData = new FormData();
    formData.append("rol", nuevoRol);

    const res = await fetchConToken(
      `${import.meta.env.VITE_API_URL}/usuarios/${username}/rol`,
      {
        method: "PUT",
        body: formData,
      }
    );

    if (res.ok) cargarUsuarios();
    else alert("Error al actualizar rol");
  };

  const generarPassword = () => {
    const random = Math.random().toString(36).slice(-5);
    return `Frio${random.charAt(0).toUpperCase()}${random.slice(1)}!`;
  };

  const resetearPassword = async (username) => {
    const nueva = resetPasswords[username];
    if (!nueva || nueva.length < 4) {
      alert("Ingresá una contraseña válida.");
      return;
    }

    const formData = new FormData();
    formData.append("new_password", nueva);

    const res = await fetchConToken(
      `${import.meta.env.VITE_API_URL}/usuarios/${username}/reset_password`,
      {
        method: "PUT",
        body: formData,
      }
    );

    if (res.ok) {
      alert(`Contraseña reseteada para ${username}`);
      setResetPasswords((prev) => ({ ...prev, [username]: "" }));
    } else {
      alert("Error al resetear contraseña");
    }
  };

  if (error) {
    return <p className="text-red-600">Hubo un error al cargar los usuarios.</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Panel de Administración</h2>

      {/* Formulario de creación de usuario */}
      <div className="bg-white border p-4 mb-6 rounded shadow-md">
        <h3 className="text-lg font-semibold mb-2">Crear nuevo usuario</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target;
            const username = form.username.value.trim();
            const password = form.password.value.trim();
            const rol = form.rol.value;
            const activo = form.activo.value;

            if (username.length < 3) {
              alert("El nombre de usuario debe tener al menos 3 caracteres.");
              return;
            }
            if (password.length < 4) {
              alert("La contraseña debe tener al menos 4 caracteres.");
              return;
            }

            const data = new FormData();
            data.append("username", username);
            data.append("password", password);
            data.append("rol", rol);
            data.append("activo", activo);

            const res = await fetchConToken(`${import.meta.env.VITE_API_URL}/usuarios`, {
              method: "POST",
              body: data,
            });

            if (res.ok) {
              alert("✅ Usuario creado con éxito");
              form.reset();
              cargarUsuarios();
            } else {
              alert("❌ Error al crear usuario (¿ya existe?).");
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm"
        >
          <input
            name="username"
            placeholder="Nombre de usuario"
            required
            minLength={3}
            className="border px-2 py-1 rounded"
          />
          <input
            name="password"
            type="password"
            placeholder="Contraseña"
            required
            minLength={4}
            className="border px-2 py-1 rounded"
          />
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
            className="col-span-1 sm:col-span-4 bg-blue-600 text-white rounded py-1 hover:bg-blue-700"
          >
            Crear usuario
          </button>
        </form>
      </div>

      {/* Tabla de usuarios */}
      {usuarios.length === 0 ? (
        <p className="text-gray-600">No hay usuarios registrados.</p>
      ) : (
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
                <td className="border px-4 py-2">{u.activo ? "Activo" : "Inactivo"}</td>
                <td className="border px-4 py-2">{u.last_login || "—"}</td>
                <td className="border px-4 py-2">
                  <select
                    value={rolesEdit[u.username] || u.rol}
                    onChange={(e) =>
                      setRolesEdit((prev) => ({
                        ...prev,
                        [u.username]: e.target.value,
                      }))
                    }
                    className="border p-1 rounded"
                  >
                    <option value="admin">admin</option>
                    <option value="usuario">usuario</option>
                  </select>
                  <button
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
                      onChange={(e) =>
                        setResetPasswords((prev) => ({
                          ...prev,
                          [u.username]: e.target.value,
                        }))
                      }
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() =>
                        setResetPasswords((prev) => ({
                          ...prev,
                          [u.username]: generarPassword(),
                        }))
                      }
                      className="bg-yellow-500 text-white px-2 rounded hover:bg-yellow-600"
                    >
                      Sugerir
                    </button>
                    <button
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
                      onClick={() => suspenderUsuario(u.username)}
                      className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 mr-2"
                    >
                      Suspender
                    </button>
                  ) : (
                    <button
                      onClick={() => activarUsuario(u.username)}
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 mr-2"
                    >
                      Activar
                    </button>
                  )}
                  <button
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
      )}
    </div>
  );
}
