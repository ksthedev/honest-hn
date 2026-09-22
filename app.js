const API = "https://honest-hn-api.contatoksdev.workers.dev";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

let current = localStorage.getItem("honestHN_current");
let posts = [];

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

async function getMe() {
  if (!current) return null;

  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: current
      })
    });

    return data.user;
  } catch {
    localStorage.removeItem("honestHN_current");
    current = null;
    return null;
  }
}

function show(id) {
  ["auth", "signup", "app"].forEach(x => $(x).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function avatar(user) {
  return user?.pfp
    ? `<img class="avatar" src="${esc(user.pfp)}">`
    : `<div class="avatar">${esc(user?.name?.[0] || "?")}</div>`;
}

async function profile() {
  const u = await getMe();

  if (!u) return;

  $("profile").innerHTML = `
    <div class="profile">
      ${avatar(u)}
      <div>
        <b>${esc(u.name)} ${u.verified ? "🔵" : ""}</b><br>
        <span>@${esc(u.username)}</span>
      </div>
    </div>
    <p>${esc(u.bio || "No bio yet.")}</p>
  `;
}

async function feed() {
  try {
    posts = await api("/api/feed");

    $("feed").innerHTML = posts.length
      ? posts.map(p => {

          const u = p.user || {
            name: "Unknown",
            username: p.author,
            pfp: "",
            verified: false
          };

          const edit =
            p.author === current &&
            Date.now() - p.createdAt < 600000;

          return `
            <article class="post">

              ${p.image
                ? `<img src="${esc(p.image)}">`
                : ""
              }

              <div class="body">

                <div class="posthead">
                  ${avatar(u)}

                  <div>
                    <b>
                      ${esc(u.name)}
                      ${u.verified ? "🔵" : ""}
                    </b>
                    <br>
                    <span>@${esc(u.username)}</span>
                  </div>
                </div>

                <div class="title">
                  ${esc(p.title)}
                </div>

                <div class="content">
                  ${esc(p.content)}
                </div>

                <div class="actions">

                  <button onclick="likePost('${esc(p.id)}')">
                    ♥ ${p.likes.length}
                  </button>

                  <button onclick="document.getElementById('c-${esc(p.id)}').focus()">
                    💬 ${p.comments.length}
                  </button>

                  ${
                    edit
                      ? `<button onclick="editPost('${esc(p.id)}')">
                           ✎ Edit
                         </button>`
                      : ""
                  }

                  ${
                    p.author === current
                      ? `<button onclick="delPost('${esc(p.id)}')">
                           Delete
                         </button>`
                      : ""
                  }

                </div>

              </div>

              <div class="comments">

                ${
                  p.comments.map(c => `
                    <div class="comment">
                      <b>@${esc(c.author)}</b>
                      ${esc(c.text)}
                    </div>
                  `).join("")
                }

                <form
                  class="commentForm"
                  onsubmit="comment(event,'${esc(p.id)}')"
                >
                  <input
                    id="c-${esc(p.id)}"
                    maxlength="500"
                    placeholder="Reply directly to this post..."
                    required
                  >

                  <button>Reply</button>
                </form>

              </div>

            </article>
          `;

        }).join("")

      : `
        <div class="post">
          <div class="body">
            <h3>No posts yet.</h3>
            <p>Be the first person to trust the system.</p>
          </div>
        </div>
      `;

  } catch (err) {
    console.error(err);

    $("feed").innerHTML = `
      <div class="post">
        <div class="body">
          <h3>Couldn't load posts.</h3>
          <p>${esc(err.message)}</p>
        </div>
      </div>
    `;
  }
}


// =========================
// LOGIN
// =========================

$("login").onsubmit = async e => {
  e.preventDefault();

  const username = $("loginUser").value.trim();

  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username
      })
    });

    current = data.user.username;

    localStorage.setItem(
      "honestHN_current",
      current
    );

    show("app");

    await profile();
    await feed();

  } catch (err) {
    alert("No account found. Create one first.");
  }
};


// =========================
// SIGN UP
// =========================

$("signupOpen").onclick = () => show("signup");

$("back").onclick = () => show("auth");

$("signupForm").onsubmit = async e => {
  e.preventDefault();

  const name = $("name").value.trim();
  const username = $("username").value.trim();

  try {

    const data = await api("/api/signup", {
      method: "POST",
      body: JSON.stringify({
        name,
        username
      })
    });

    current = data.user.username;

    localStorage.setItem(
      "honestHN_current",
      current
    );

    show("app");

    await profile();
    await feed();

  } catch (err) {
    alert(err.message);
  }
};


// =========================
// LOG OUT
// =========================

$("logout").onclick = () => {

  current = null;

  localStorage.removeItem(
    "honestHN_current"
  );

  show("auth");
};


// =========================
// EDIT PROFILE
// =========================

$("editProfile").onclick = async () => {

  const u = await getMe();

  if (!u) return;

  $("pName").value = u.name;
  $("pUser").value = u.username;
  $("pBio").value = u.bio;
  $("pPfp").value = u.pfp;
  $("pBanner").value = u.banner;
  $("pVerify").checked = !!u.verified;

  $("profileDialog").showModal();
};

$("closeProfile").onclick = () =>
  $("profileDialog").close();

$("profileForm").onsubmit = async e => {
  e.preventDefault();

  const username = $("pUser").value.trim();

  if (username !== current) {
    alert("Changing username is not supported yet.");
    return;
  }

  try {

    await api(`/api/users/${encodeURIComponent(current)}`, {
      method: "PATCH",

      body: JSON.stringify({
        name: $("pName").value.trim(),
        bio: $("pBio").value.trim(),
        pfp: $("pPfp").value.trim(),
        banner: $("pBanner").value.trim(),
        verified: $("pVerify").checked
      })
    });

    $("profileDialog").close();

    await profile();
    await feed();

  } catch (err) {
    alert(err.message);
  }
};


// =========================
// CREATE POST
// =========================

$("newPost").onclick = () => {
  $("postForm").reset();
  $("postDialog").showModal();
};

$("closePost").onclick = () =>
  $("postDialog").close();

$("postForm").onsubmit = async e => {
  e.preventDefault();

  try {

    await api("/api/posts", {
      method: "POST",

      body: JSON.stringify({
        author: current,
        title: $("postTitle").value.trim(),
        content: $("postContent").value.trim(),
        image: $("postImage").value.trim()
      })
    });

    $("postDialog").close();

    await feed();

  } catch (err) {
    alert(err.message);
  }
};


// =========================
// LIKE
// =========================

window.likePost = async id => {

  try {

    await api(`/api/posts/${encodeURIComponent(id)}/like`, {
      method: "POST",

      body: JSON.stringify({
        username: current
      })
    });

    await feed();

  } catch (err) {
    alert(err.message);
  }
};


// =========================
// COMMENT
// =========================

window.comment = async (e, id) => {

  e.preventDefault();

  const input = $("c-" + id);

  try {

    await api(
      `/api/posts/${encodeURIComponent(id)}/comments`,
      {
        method: "POST",

        body: JSON.stringify({
          author: current,
          text: input.value.trim()
        })
      }
    );

    await feed();

  } catch (err) {
    alert(err.message);
  }
};


// =========================
// DELETE POST
// =========================

window.delPost = async id => {

  if (!confirm("Delete this post?")) return;

  try {

    await api(
      `/api/posts/${encodeURIComponent(id)}`,
      {
        method: "DELETE",

        body: JSON.stringify({
          author: current
        })
      }
    );

    await feed();

  } catch (err) {
    alert(err.message);
  }
};


// =========================
// EDIT POST
// =========================

window.editPost = async id => {

  const p = posts.find(x => x.id === id);

  if (!p) return;

  if (Date.now() - p.createdAt >= 600000) {
    alert("The 10-minute edit window has expired.");
    return;
  }

  const title = prompt(
    "Title:",
    p.title
  );

  if (title === null) return;

  const content = prompt(
    "Content:",
    p.content
  );

  if (content === null) return;

  try {

    await api(
      `/api/posts/${encodeURIComponent(id)}`,
      {
        method: "PATCH",

        body: JSON.stringify({
          author: current,
          title,
          content
        })
      }
    );

    await feed();

  } catch (err) {
    alert(err.message);
  }
};


// =========================
// START
// =========================

(async () => {

  const me = await getMe();

  if (me) {
    show("app");
    await profile();
    await feed();
  } else {
    show("auth");
  }

})();