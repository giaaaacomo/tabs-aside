const TAB_LOADER_PREFIX = browser.extension.getURL("tab-loader/load.html") + "?";

class SidebarSession {
	
	constructor(bmID, expand=false) {
		this.title = bmID;
		this.sessionID = bmID; // bookmark node ID

		this.expanded = expand;
		this.state = "closed";

		// create html structure
		this.html = document.createElement("div");
		this.html.classList.add("session", "collapsed");

		// titlebar
		let titlebar = createHTMLElement("div", {
			"title": "click to reveal tabs"
		}, ["titlebar"]);
		this.titleElement = createHTMLElement("div", {}, ["title"], this.title);
		this.counterElement = createHTMLElement("div", {}, ["counter"], `- tabs`);
		[this.titleElement, this.counterElement].forEach(i => titlebar.appendChild(i));
		
		titlebar.addEventListener("click", () => {
			this.toggle();
		});
		this.titlebar = titlebar;
		this.html.appendChild(titlebar);

		// control
		let controls = createHTMLElement("div", {}, ["controls"]);
		this.html.appendChild(controls);

		// restore
		let a = document.createElement("a");
		a.innerText = "Restore tabs";
		a.href = "#";
		a.title = "Restore all tabs from this session";
		a.addEventListener("click", e => {
			e.stopPropagation();
			e.preventDefault();

			if (this.state !== "closed") { return; }

			this.restore();
		});
		controls.appendChild(a);
		
		// edit
		let edit = document.createElement("div");
		edit.classList.add("edit", "button");
		edit.title = "rename session";
		controls.appendChild(edit);
		edit.addEventListener("click", e => {
			e.stopPropagation();

			let title = prompt("Enter session title:", this.title).trim();

			if (title) {
				this.changeTitle(title);
			}

		});

		// delete button
		let del = document.createElement("div");
		del.classList.add("delete", "button");
		del.title = "Remove";
		controls.appendChild(del);
		del.addEventListener("click", e => {
			e.stopPropagation();

			if (e.ctrlKey || confirm("Do you really want to delete this session from your bookmarks?")) {
				this.remove();
			}
		});
		
		// tab section
		this.tabsection = document.createElement("div");
		this.tabsection.classList.add("tabs");
		this.html.appendChild(this.tabsection);

		this.update();
	}

	_loadTabsFromBookmarks() {
		return browser.bookmarks.getChildren(this.sessionID).then(
			bms => bms.filter(x => !!x.url)
		);
	}

	_generateTabHTML() {
		this._loadTabsFromBookmarks().then(bms => {
			let tabsOL = bms.reduce((ol, tab) => {
				let li = document.createElement("li");

				let a = document.createElement("a");
				a.classList.add("tab");
				a.href = tab.url;

				let title = tab.title;

				if(tab.title) {
					if(tab.title.length > 9 && tab.title.substr(0, 9) === "[pinned] ") {
						tab.pinned = true;
						tab.title = title = tab.title.substr(9);
						a.classList.add("pinned");
					}
				} else {
					title = (new URL(tab.url)).hostname + " [no title]";
					tab.pinned = false;
				}

				a.innerText = title;
				
				li.appendChild(a);
				ol.appendChild(li);
				return ol;
			}, document.createElement("ol"));

			this.tabsection.innerHTML = "";
			this.tabsection.appendChild(tabsOL);
		});
	}

	update() {
		browser.bookmarks.get(this.sessionID).then(bm => {
			this.title = bm.title;
			this.titleElement.inenrText = bm.title;
		});

		this._loadTabsFromBookmarks().then(ts => {
			this.counterElement.innerText = `${ts.length} tabs`;

			if (this.expanded) {
				// TODO: pass ts to generateTabHTML
				this._generateTabHTML();
			}
		});
	}

	expand() {
		this.expanded = true;
		this.html.classList.add("expanded");
		this.html.classList.remove("collapsed");
		this.titlebar.title = "click to hide tabs";

		this._generateTabHTML();
	}

	collapse() {
		this.expanded = false;
		this.html.classList.add("collapsed");
		this.html.classList.remove("expanded");
		this.titlebar.title = "click to reveal tabs";

		this.tabsection.innerHTML = "";
	}

	toggle() {
		if (this.expanded) {
			this.collapse();
		} else {
			this.expand();
		}
	}

	restore() {
		console.log("restoring tabs from " + this.title);
		this.collapse();
		this.state = "restoring";
		externalASMRequest("restoreSession", [this.sessionID]).then(() => {
			this.state = "active";
		});
	}

	remove() {
		this.html.remove();
		this.html = null;

		browser.bookmarks.removeTree(this.sessionID).then(() => {
			return sendRefresh();
		});
	}

	changeTitle(newTitle) {
		if (newTitle.length > 0) {
			this.title = newTitle;

			return browser.bookmarks.update(this.sessionID, {
				title: newTitle
			}).then(() => {
				this.titleElement.innerText = newTitle;
				return sendRefresh();
			}, e => {
				alert(`Title was not updated: ${e}`);
			});
		} else {
			return Promise.reject("invalid title");
		}
	}
}

function createProperties(tab) {
	let o = {
		active: false,
		url: TAB_LOADER_PREFIX + `title=${tab.title}&url=` + encodeURIComponent(tab.url)
	};

	if (targetWindowID !== null) {
		o.windowId = targetWindowID;
	}

	if(tab.pinned) {
		o.pinned = true;
	}

	return o;
}

function createHTMLElement(tagName, attrs, classes, content) {
	let element = document.createElement(tagName);

	// add attributes
	Object.getOwnPropertyNames(attrs).forEach(k => {
		element.setAttribute(k, attrs[k]);
	});

	// add classes
	classes.forEach(c => { element.classList.add(c); });

	if (content) {
		element.innerHTML = content;
	}

	return element;
}