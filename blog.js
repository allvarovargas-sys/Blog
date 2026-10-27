const SUPABASE_URL = "https://ruoysnqkrtoyfzmpwfog.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1b3lzbnFrcnRveWZ6bXB3Zm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MjQ3NDgsImV4cCI6MjEwODUwMDc0OH0.1FbycPCWfr76gtlnvs_lgpwO2T885OSZlK1O_SjC4S0";
const BUCKET_NAME = "recuerdos";

const loginForm = document.getElementById("login-form");
const loginAccess = document.querySelector(".owner-access");
const recoveryForm = document.getElementById("recovery-form");
const requestPasswordResetButton = document.getElementById("request-password-reset");
const unauthorizedPanel = document.getElementById("unauthorized-panel");
const unauthorizedLogoutButton = document.getElementById("unauthorized-logout-button");
const editorPanel = document.getElementById("editor-panel");
const logoutButton = document.getElementById("logout-button");
const fileInput = document.getElementById("file-input");
const chooseButton = document.getElementById("choose-files");
const dropzone = document.getElementById("dropzone");
const captionInput = document.getElementById("caption-input");
const gallery = document.getElementById("gallery");
const itemCount = document.getElementById("item-count");
const statusMessage = document.getElementById("status-message");
const posts = [];
let activeFilter = "all";
let ownerSession = null;
let isBlogAdmin = false;
let isPasswordRecovery = false;
let supabaseClient = null;

function showStatus(message) {
  statusMessage.textContent = message;
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(value));
}

function updateOwnerView() {
  loginAccess.hidden = Boolean(ownerSession);
  unauthorizedPanel.hidden = !ownerSession || isBlogAdmin;
  editorPanel.hidden = !isBlogAdmin;
  if (!isPasswordRecovery) {
    recoveryForm.hidden = true;
  }
  renderGallery();
}

async function updateAdminAccess(session) {
  if (!session) {
    isBlogAdmin = false;
    updateOwnerView();
    return;
  }

  const { data, error } = await supabaseClient
    .from("blog_admins")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (ownerSession?.user.id !== session.user.id) {
    return;
  }
  if (error) {
    isBlogAdmin = false;
    updateOwnerView();
    showStatus(`No se pudieron comprobar los permisos de administración: ${error.message}`);
    return;
  }

  isBlogAdmin = Boolean(data);
  updateOwnerView();
  if (!isBlogAdmin) {
    showStatus("Esta cuenta ha iniciado sesión, pero todavía no tiene permisos de administración.");
  }
}

async function loadPosts() {
  const { data, error } = await supabaseClient
    .from("posts")
    .select("id, user_id, file_path, file_name, content_type, file_size, caption, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  posts.splice(0, posts.length, ...data.map((post) => ({
    ...post,
    url: supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(post.file_path).data.publicUrl,
  })));
  renderGallery();
}

function renderGallery() {
  gallery.replaceChildren();
  const visiblePosts = posts.filter(
    (post) => activeFilter === "all" || post.content_type.startsWith(`${activeFilter}/`),
  );

  itemCount.textContent = `${posts.length} ${posts.length === 1 ? "publicación" : "publicaciones"}`;

  if (visiblePosts.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    const title = document.createElement("p");
    const description = document.createElement("p");

    if (posts.length === 0) {
      title.textContent = "Todavía no hay publicaciones";
      description.textContent = ownerSession
        ? "Publica fotos o vídeos para que aparezcan aquí."
        : "Las nuevas publicaciones aparecerán aquí.";
    } else {
      title.textContent = "No hay publicaciones en esta categoría";
      description.textContent = "Prueba con otro filtro para ver los recuerdos.";
    }

    emptyState.append(title, description);
    gallery.append(emptyState);
    return;
  }

  visiblePosts.forEach((post) => {
    const card = document.createElement("article");
    card.className = "media-card";

    const preview = document.createElement("div");
    preview.className = "media-preview";
    const media = document.createElement(post.content_type.startsWith("video/") ? "video" : "img");
    media.src = post.url;

    if (media instanceof HTMLImageElement) {
      media.alt = post.caption || post.file_name;
    } else {
      media.controls = true;
      media.preload = "metadata";
      media.setAttribute("aria-label", post.caption || post.file_name);
    }

    const info = document.createElement("div");
    info.className = "card-info";
    const details = document.createElement("div");
    details.className = "file-details";

    if (post.caption) {
      const caption = document.createElement("p");
      caption.className = "file-name";
      caption.textContent = post.caption;
      details.append(caption);
    }

    const metadata = document.createElement("p");
    metadata.className = "file-size";
    metadata.textContent = `${post.file_name} · ${formatDate(post.created_at)} · ${formatSize(post.file_size)}`;
    details.append(metadata);

    const actions = document.createElement("div");
    actions.className = "file-actions";
    const downloadLink = document.createElement("a");
    downloadLink.className = "download-button";
    downloadLink.href = post.url;
    downloadLink.download = post.file_name;
    downloadLink.target = "_blank";
    downloadLink.rel = "noopener";
    downloadLink.setAttribute("aria-label", `Descargar ${post.file_name}`);
    downloadLink.title = `Descargar ${post.file_name}`;
    downloadLink.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    actions.append(downloadLink);

    if (isBlogAdmin) {
      const removeButton = document.createElement("button");
      removeButton.className = "remove-button";
      removeButton.type = "button";
      removeButton.setAttribute("aria-label", `Eliminar ${post.file_name}`);
      removeButton.title = `Eliminar ${post.file_name}`;
      removeButton.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16m-10 4v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      removeButton.addEventListener("click", () => removePost(post));
      actions.append(removeButton);
    }

    preview.append(media);
    info.append(details, actions);
    card.append(preview, info);
    gallery.append(card);
  });
}

async function removePost(post) {
  if (!ownerSession || !isBlogAdmin) {
    showStatus("Inicia sesión con una cuenta administradora para eliminar publicaciones.");
    return;
  }

  if (!window.confirm(`¿Eliminar "${post.file_name}" del blog público?`)) {
    return;
  }

  const { error: storageError } = await supabaseClient.storage
    .from(BUCKET_NAME)
    .remove([post.file_path]);
  if (storageError) {
    showStatus(`No se pudo eliminar el archivo: ${storageError.message}`);
    return;
  }

  const { error: postError } = await supabaseClient
    .from("posts")
    .delete()
    .eq("id", post.id);
  if (postError) {
    showStatus(`Se borró el archivo, pero no se pudo quitar su publicación. Recarga el blog y revisa el panel: ${postError.message}`);
    return;
  }

  posts.splice(posts.indexOf(post), 1);
  renderGallery();
  showStatus(`${post.file_name} se eliminó del blog.`);
}

async function publishFiles(selectedFiles) {
  const validFiles = Array.from(selectedFiles).filter(
    (file) => file.type.startsWith("image/") || file.type.startsWith("video/"),
  );
  const rejectedCount = selectedFiles.length - validFiles.length;

  if (!ownerSession || !isBlogAdmin) {
    showStatus("Inicia sesión con una cuenta administradora para publicar archivos.");
    return;
  }
  if (validFiles.length === 0) {
    showStatus(rejectedCount > 0 ? "No se añadieron archivos: elige fotos o vídeos." : "");
    return;
  }

  const caption = captionInput.value.trim();
  let publishedCount = 0;

  for (const [index, file] of validFiles.entries()) {
    showStatus(`Publicando ${index + 1} de ${validFiles.length}: ${file.name}`);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${ownerSession.user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      showStatus(`No se pudo publicar ${file.name}: ${uploadError.message}`);
      break;
    }

    const { error: postError } = await supabaseClient.from("posts").insert({
      user_id: ownerSession.user.id,
      file_path: filePath,
      file_name: file.name,
      content_type: file.type,
      file_size: file.size,
      caption,
    });

    if (postError) {
      const { error: cleanupError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .remove([filePath]);
      const cleanupMessage = cleanupError
        ? ` Además, no se pudo limpiar el archivo subido: ${cleanupError.message}`
        : "";
      showStatus(`El archivo se subió, pero no se pudo crear la publicación: ${postError.message}.${cleanupMessage}`);
      break;
    }

    publishedCount += 1;
  }

  fileInput.value = "";
  if (publishedCount > 0) {
    try {
      await loadPosts();
    } catch (error) {
      showStatus(`Se publicaron ${publishedCount} archivos, pero no se pudo actualizar la galería: ${error.message}`);
      return;
    }
    showStatus(
      `Se publicaron ${publishedCount} archivos${rejectedCount ? `; se omitieron ${rejectedCount} archivos que no son fotos ni vídeos` : ""}.`,
    );
    captionInput.value = "";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    showStatus("Configura Supabase antes de iniciar sesión.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: document.getElementById("login-email").value.trim(),
    password: document.getElementById("login-password").value,
  });

  if (error) {
    showStatus(`No se pudo iniciar sesión: ${error.message}`);
    return;
  }

  showStatus("Sesión iniciada.");
});

requestPasswordResetButton.addEventListener("click", async () => {
  if (!supabaseClient) {
    showStatus("No se pudo conectar con Supabase.");
    return;
  }
  if (!["http:", "https:"].includes(window.location.protocol)) {
    showStatus("El enlace de recuperación necesita una dirección web (http o https). Publica la página o ábrela con un servidor local; no funciona desde un archivo file://.");
    return;
  }

  const email = document.getElementById("login-email").value.trim();
  if (!email) {
    showStatus("Escribe primero el correo de la cuenta.");
    document.getElementById("login-email").focus();
    return;
  }

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    showStatus(`No se pudo enviar el correo de recuperación: ${error.message}`);
    return;
  }

  showStatus("Si existe una cuenta con ese correo, recibirá un enlace para crear una contraseña nueva. Revisa también el correo no deseado.");
});

recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient || !isPasswordRecovery) {
    showStatus("Abre el enlace de recuperación más reciente que recibiste por correo.");
    return;
  }

  const password = document.getElementById("new-password").value;
  const confirmation = document.getElementById("confirm-password").value;
  if (password !== confirmation) {
    showStatus("Las contraseñas no coinciden.");
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) {
    showStatus(`No se pudo actualizar la contraseña: ${error.message}`);
    return;
  }

  isPasswordRecovery = false;
  recoveryForm.hidden = true;
  recoveryForm.reset();
  const { data, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) {
    showStatus(`La contraseña se actualizó, pero no se pudo comprobar la sesión: ${sessionError.message}`);
    return;
  }

  ownerSession = data.session;
  await updateAdminAccess(ownerSession);
  showStatus("Contraseña actualizada. Ya puedes usar la cuenta.");
});

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showStatus(`No se pudo cerrar sesión: ${error.message}`);
    return;
  }

  ownerSession = null;
  isBlogAdmin = false;
  updateOwnerView();
  showStatus("Sesión cerrada.");
}

logoutButton.addEventListener("click", signOut);
unauthorizedLogoutButton.addEventListener("click", signOut);

chooseButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  await publishFiles(fileInput.files);
});

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter-button").forEach((filterButton) => {
      filterButton.setAttribute("aria-pressed", String(filterButton === button));
    });
    renderGallery();
    showStatus("");
  });
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  });
});

dropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  await publishFiles(event.dataTransfer.files);
});

async function initializeBlog() {
  if (!window.supabase) {
    showStatus("No se pudo cargar Supabase. Comprueba tu conexión a internet y vuelve a cargar la página.");
    return;
  }
  if (
    SUPABASE_URL === "PON_AQUI_LA_URL_DEL_PROYECTO"
    || SUPABASE_PUBLISHABLE_KEY === "PON_AQUI_LA_CLAVE_PUBLICA"
  ) {
    showStatus("Falta configurar la URL y la clave pública de Supabase antes de publicar el blog.");
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      isPasswordRecovery = true;
      ownerSession = session;
      loginAccess.hidden = true;
      editorPanel.hidden = true;
      unauthorizedPanel.hidden = true;
      recoveryForm.hidden = false;
      document.getElementById("new-password").focus();
      showStatus("Enlace de recuperación reconocido. Elige una contraseña nueva.");
      return;
    }

    ownerSession = session;
    isBlogAdmin = false;
    updateOwnerView();
    window.setTimeout(() => updateAdminAccess(session), 0);
  });

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showStatus(`No se pudo comprobar la sesión: ${error.message}`);
    return;
  }

  ownerSession = data.session;
  await updateAdminAccess(ownerSession);
  try {
    await loadPosts();
  } catch (loadError) {
    showStatus(`No se pudieron cargar las publicaciones: ${loadError.message}`);
  }
}

initializeBlog();
