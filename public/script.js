(function () {
  const BASE = window.location.origin;
  const list = document.getElementById("projectList");
  const copyBtn = document.querySelector('[data-clipboard]');

  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to load " + path);
    return res.json();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  async function render() {
    try {
      const data = await fetchJson(`${BASE}/api/v1/projects`);
      const projects = data.data.projects || [];

      list.innerHTML = "";

      for (const project of projects) {
        const item = document.createElement("div");
        item.className = "project-item";

        const name = document.createElement("div");
        name.className = "project-name";
        name.textContent = project.displayName || project.id;

        const repo = document.createElement("div");
        repo.className = "project-repo";
        repo.textContent = project.repository;

        const version = document.createElement("div");
        version.className = "project-muted";
        version.textContent = "No releases yet";

        item.appendChild(name);
        item.appendChild(repo);
        item.appendChild(version);

        try {
          const latest = await fetchJson(`${BASE}/api/v1/${project.id}/latest`);
          const release = latest.data;
          if (release && release.version) {
            version.className = "project-version";
            version.textContent = release.version;
          }
        } catch (e) {
          // keep muted state
        }

        list.appendChild(item);
      }
    } catch (e) {
      list.innerHTML = '<div class="placeholder">Unable to load projects.</div>';
    }
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = copyBtn.getAttribute("data-clipboard");
      try {
        await navigator.clipboard.writeText(text);
        const old = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = old; }, 1500);
      } catch (e) {
        /* clipboard unavailable */
      }
    });
  }

  render();
})();
