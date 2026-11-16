window.__ModuleLoader__.load({
  id: 'dsh-switcher',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    /* BUILD_CORE */
    /* BUILD_MOTION */
    /* BUILD_HOST */
    /* BUILD_KEYBOARD */
    /* BUILD_VIEW */
    /* BUILD_SETTINGS */
    /* BUILD_CSS */
    const inject = ['slots', 'sidebarRight', 'sessions', 'uiWorkspace', 'uiSession', 'conversation', 'workspaces', 'theme'];
    function apply(ctx) {
      const prefsStore = createPrefsStore(typeof localStorage !== 'undefined' ? localStorage : undefined);
      let styleElement = null, styleUsers = 0, liveHost = null, liveController = null;

      const localeService = () => (typeof ctx.get === 'function' ? ctx.get('locale') : ctx.locale);
      const getHostLocale = () => {
        const active = localeService()?.getSnapshot?.()?.active;
        return active ? normalizeLocale(active) : detectEnvironmentLocale();
      };
      const subscribeHostLocale = fn => {
        const stops = [];
        const svc = localeService();
        if (typeof svc?.subscribe === 'function') stops.push(svc.subscribe(fn));
        if (typeof ctx.on === 'function') stops.push(ctx.on('locale/change', fn));
        return () => { stops.forEach(stop => stop?.()); };
      };

      function retainStyle() {
        if (++styleUsers === 1) {
          styleElement = document.createElement('style');
          styleElement.dataset.dshSwitcher = 'true';
          styleElement.textContent = SWITCHER_CSS;
          document.head.append(styleElement);
        }
        let released = false;
        return () => {
          if (released) return;
          released = true;
          if (--styleUsers === 0) { styleElement?.remove(); styleElement = null; }
        };
      }

      function Panel() {
        const anchor = React.useRef(null);
        React.useEffect(() => {
          const releaseStyle = retainStyle();
          const host = createHostAdapter(ctx, {
            getPrefs: () => prefsStore.getSnapshot(),
            getLocale: getHostLocale,
          });
          const prefsListeners = new Set();
          const stopPrefs = prefsStore.subscribe(() => { for (const fn of [...prefsListeners]) fn(); });
          const wrappedHost = {
            ...host,
            prefs: () => prefsStore.getSnapshot(),
            subscribe(fn) {
              const stopHost = host.subscribe(fn);
              prefsListeners.add(fn);
              return () => { stopHost(); prefsListeners.delete(fn); };
            },
          };
          const mounted = mountSwitcher(anchor.current, wrappedHost);
          liveHost = wrappedHost; liveController = mounted;
          return () => {
            if (liveController === mounted) { liveController = null; liveHost = null; }
            stopPrefs(); mounted.destroy(); host.destroy(); releaseStyle();
          };
        }, []);
        return createPortal(React.createElement('div', { ref: anchor, 'data-dsh-switcher-root': '' }), document.body);
      }

      function ConfigSummary() {
        const [loc, setLoc] = React.useState(getHostLocale);
        React.useEffect(() => subscribeHostLocale(() => setLoc(getHostLocale())), []);
        return uiCopy(loc).configSummary;
      }

      function ConfigPage() {
        const anchor = React.useRef(null);
        React.useEffect(() => {
          const releaseStyle = retainStyle();
          const settings = mountSettingsPanel(anchor.current, {
            prefs: prefsStore,
            getTheme: () => ctx.theme.getTheme().active.colorScheme === 'dark' ? 'dark' : 'light',
            subscribeTheme: fn => ctx.on('theme/change', fn),
            getLocale: getHostLocale,
            subscribeLocale: subscribeHostLocale,
            canPreview: () => (liveHost?.candidates().length || 0) >= 2,
            onPreview: () => liveController?.begin(1, true),
          });
          const stopSessions = ctx.sessions.list.subscribe(() => settings.sync());
          return () => { stopSessions(); settings.destroy(); releaseStyle(); };
        }, []);
        return React.createElement('div', { ref: anchor, 'data-dsh-switcher-settings-root': '' });
      }

      function ConfigPanel(props) {
        return props?.view === 'summary'
          ? React.createElement(ConfigSummary)
          : React.createElement(ConfigPage);
      }

      ctx.effect(() => {
        const onStorage = event => { if (!event.key || event.key === PREFS_KEY) prefsStore.sync(); };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
      }, 'dsh-switcher: prefs-storage');
      ctx.effect(() => ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: 'dsh-switcher', order: 1000 }, Panel)), 'dsh-switcher: overlay');
      ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () =>
        ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-switcher' }, ConfigPanel)), 'dsh-switcher: config');
    }
    return { inject, apply };
  },
});
