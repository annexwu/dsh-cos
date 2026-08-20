const PACKAGE_ID = 'dsh-cos'
const STYLE_ID = 'dsh-cos-styles'

const CSS = `
.dsh-cos-storage-entry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  width: calc(100% - 4px);
  min-width: 0;
  margin: 0 2px 8px;
  padding: 8px 16px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .1));
  border-radius: 12px;
  background: var(--dsw-alias-button-elevated-fill, var(--dsw-alias-bg-secondary, #fff));
  color: var(--dsw-alias-label-primary, #17191c);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  transition: background-color .15s ease, border-color .15s ease, color .15s ease;
}
.dsh-cos-storage-entry:hover {
  background: var(--dsw-alias-button-floating-hover, var(--dsw-specific-sidebar-nav-item-hover, rgba(0, 0, 0, .05)));
}
.dsh-cos-storage-entry[data-active='true'] {
  border-color: var(--dsw-alias-border-l2, rgba(0, 0, 0, .1));
  background: var(--dsw-alias-button-floating-hover, var(--dsw-specific-sidebar-nav-item-active, rgba(49, 94, 251, .1)));
}
.dsh-cos-storage-entry:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #315efb);
  outline-offset: 2px;
}
.dsh-cos-storage-entry-icon {
  color: var(--dsw-alias-label-tertiary, #8b919c);
}
.dsh-cos-storage-entry-icon svg {
  display: block;
  width: 18px;
  height: 18px;
}
.dsh-cos-storage-entry:hover .dsh-cos-storage-entry-icon,
.dsh-cos-storage-entry[data-active='true'] .dsh-cos-storage-entry-icon {
  color: var(--dsw-alias-label-secondary, #5f6673);
}
.dsh-cos-storage-entry-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
}
.dsh-cos-storage-entry-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-dsh-frame][data-sidebar-collapsed] .dsh-cos-storage-entry,
[class*='collapsed'] .dsh-cos-storage-entry {
  display: flex;
  justify-content: center;
  width: 36px;
  height: 36px;
  min-height: 36px;
  margin: 0 auto 12px;
  padding: 0;
  border-color: transparent;
  background: transparent;
}
[data-dsh-frame][data-sidebar-collapsed] .dsh-cos-storage-entry:hover,
[class*='collapsed'] .dsh-cos-storage-entry:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, .06));
}
[data-dsh-frame][data-sidebar-collapsed] .dsh-cos-storage-entry-icon svg,
[class*='collapsed'] .dsh-cos-storage-entry-icon svg {
  width: 18px;
  height: 18px;
}
[data-dsh-frame][data-sidebar-collapsed] .dsh-cos-storage-entry-label,
[class*='collapsed'] .dsh-cos-storage-entry-label {
  display: none;
}
[data-pane='conversation'],
[class*='centerCol'] {
  position: relative;
}
[data-dsh-cos-storage-view] {
  position: absolute;
  inset: 0;
  z-index: 70;
  display: none;
  background: var(--dsw-alias-bg-base, #fff);
}
html[data-dsh-cos-storage-active] [data-dsh-cos-storage-view] {
  display: block;
}
html[data-dsh-cos-storage-active] [data-pane='conversation'] > :not([data-dsh-cos-storage-view]),
html[data-dsh-cos-storage-active] [class*='centerCol'] > :not([data-dsh-cos-storage-view]) {
  display: none !important;
}
.dsh-cos-storage-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  font-family: var(--dsw-font-family, Inter, system-ui, sans-serif);
}
.dsh-cos-storage-page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
}
.dsh-cos-storage-page-heading {
  flex: 1;
  min-width: 0;
}
.dsh-cos-storage-page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.4;
}
.dsh-cos-storage-page-subtitle {
  margin: 2px 0 0;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 12px;
}
.dsh-cos-storage-back {
  padding: 7px 12px;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5f6673);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}
.dsh-cos-storage-back:hover {
  background: var(--dsw-alias-interactive-bg-hover, #f4f5f7);
  color: var(--dsw-alias-label-primary, #17191c);
}
.dsh-cos-storage-page-body {
  display: grid;
  flex: 1;
  min-height: 0;
  place-items: center;
  padding: 32px;
  background: var(--dsw-alias-bg-layer-2, #f7f8fa);
}
.dsh-cos-storage-placeholder {
  width: min(520px, 100%);
  padding: 40px 32px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 16px;
  background: var(--dsw-alias-bg-base, #fff);
  text-align: center;
  box-shadow: var(--dsw-shadow-lv1, 0 4px 18px rgba(22, 29, 37, .06));
}
.dsh-cos-storage-placeholder-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 18px;
  border-radius: 16px;
  background: rgba(49, 94, 251, .1);
  color: var(--dsw-alias-state-business-primary, #315efb);
}
.dsh-cos-storage-placeholder h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
.dsh-cos-storage-placeholder p {
  margin: 0;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 13px;
  line-height: 1.7;
}
.dsh-cos-storage-toolbar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  padding: 0 24px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
  background: var(--dsw-alias-bg-base, #fff);
}
.dsh-cos-storage-toolbar__group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-cos-storage-toolbar button,
.dsh-cos-storage-pagination button,
.dsh-cos-storage-state button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2, #dde1e7);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}
.dsh-cos-storage-toolbar button:hover:not(:disabled),
.dsh-cos-storage-pagination button:hover:not(:disabled),
.dsh-cos-storage-state button:hover:not(:disabled) {
  border-color: var(--dsw-alias-state-business-primary, #315efb);
  color: var(--dsw-alias-state-business-primary, #315efb);
}
.dsh-cos-storage-toolbar button.is-primary {
  border-color: var(--dsw-alias-state-business-primary, #315efb);
  background: var(--dsw-alias-state-business-primary, #315efb);
  color: #fff;
}
.dsh-cos-storage-toolbar button.is-primary:hover:not(:disabled) {
  border-color: #244bd8;
  background: #244bd8;
  color: #fff;
}
.dsh-cos-storage-toolbar button.is-danger {
  border-color: rgba(194, 59, 59, .3);
  color: #c23b3b;
}
.dsh-cos-storage-toolbar button.is-danger:hover:not(:disabled) {
  border-color: #c23b3b;
  background: rgba(194, 59, 59, .06);
  color: #b22f2f;
}
.dsh-cos-storage-toolbar button.is-active {
  border-color: rgba(49, 94, 251, .45);
  background: rgba(49, 94, 251, .09);
  color: var(--dsw-alias-state-business-primary, #315efb);
}
.dsh-cos-storage-view-switcher {
  display: inline-flex;
  align-items: stretch;
}
.dsh-cos-storage-view-switcher button {
  min-width: 34px;
  padding: 0 8px;
  border-radius: 0;
}
.dsh-cos-storage-view-switcher button + button {
  margin-left: -1px;
}
.dsh-cos-storage-view-switcher button:first-child {
  border-radius: 8px 0 0 8px;
}
.dsh-cos-storage-view-switcher button:last-child {
  border-radius: 0 8px 8px 0;
}
.dsh-cos-storage-view-switcher button:hover,
.dsh-cos-storage-view-switcher button:focus-visible,
.dsh-cos-storage-view-switcher button.is-active {
  position: relative;
  z-index: 1;
}
.dsh-cos-storage-toolbar button:disabled,
.dsh-cos-storage-pagination button:disabled {
  cursor: not-allowed;
  opacity: .48;
}
.dsh-cos-storage-refresh-button {
  min-width: 30px;
  min-height: 30px;
  padding: 0 6px;
}
.dsh-cos-storage-refresh-button svg { width: 15px !important; height: 15px !important; }
.dsh-cos-storage-refresh-button__label {
  display: none;
}
.dsh-cos-storage-refresh-button__label > span {
  grid-area: 1 / 1;
  white-space: nowrap;
}
.dsh-cos-storage-refresh-button__loading,
.dsh-cos-storage-refresh-button.is-loading .dsh-cos-storage-refresh-button__idle {
  visibility: hidden;
}
.dsh-cos-storage-refresh-button.is-loading .dsh-cos-storage-refresh-button__loading {
  visibility: visible;
}
.dsh-cos-storage-toolbar button svg,
.dsh-cos-storage-state svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dsh-cos-storage-toolbar__divider {
  width: 1px;
  height: 22px;
  margin: 0 3px;
  background: var(--dsw-alias-border-l2, #e1e4e8);
}
.dsh-cos-storage-toolbar__selection {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 5px;
  padding: 0 5px 0 10px;
  border-radius: 7px;
  background: rgba(49, 94, 251, .08);
  color: var(--dsw-alias-state-business-primary, #315efb);
  font-size: 12px;
}
.dsh-cos-storage-toolbar__selection button {
  width: 22px;
  min-width: 22px;
  min-height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 16px;
  line-height: 1;
}
.dsh-cos-storage-selection-bar {
  display: flex;
  flex: none;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 24px;
  border-bottom: 1px solid rgba(49, 94, 251, .16);
  background: rgba(49, 94, 251, .07);
  color: var(--dsw-alias-state-business-primary, #315efb);
  font-size: 12px;
}
.dsh-cos-storage-selection-bar > div { display: flex; gap: 8px; }
.dsh-cos-storage-selection-bar button {
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid rgba(49, 94, 251, .28);
  border-radius: 7px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-state-business-primary, #315efb);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}
.dsh-cos-storage-selection-bar button.is-danger { border-color: rgba(194, 59, 59, .32); color: #c23b3b; }
.dsh-cos-storage-selection-bar button:disabled { cursor: not-allowed; opacity: .5; }
.dsh-cos-storage-breadcrumb {
  display: flex;
  flex: none;
  align-items: center;
  gap: 7px;
  min-height: 46px;
  padding: 0 24px;
  overflow: hidden;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 13px;
  white-space: nowrap;
}
.dsh-cos-storage-breadcrumb button {
  max-width: 200px;
  padding: 3px 2px;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-state-business-primary, #315efb);
  cursor: pointer;
  font: inherit;
  text-overflow: ellipsis;
}
.dsh-cos-storage-breadcrumb button.is-current {
  color: var(--dsw-alias-label-primary, #17191c);
  cursor: default;
  font-weight: 600;
}
.dsh-cos-storage-root-prefix {
  min-width: 0;
  margin-left: auto;
  padding: 3px 8px;
  overflow: hidden;
  border-radius: 5px;
  background: var(--dsw-alias-interactive-bg-hover, #f1f3f6);
  color: var(--dsw-alias-label-secondary, #626a76);
  font-size: 11px;
  text-overflow: ellipsis;
}
.dsh-cos-storage-content {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 22px 24px;
  overflow: auto;
  background: var(--dsw-alias-bg-layer-2, #f7f8fa);
}
.dsh-cos-storage-content.is-list {
  padding: 0;
  background: var(--dsw-alias-bg-base, #fff);
}
.dsh-cos-storage-selection-box {
  position: fixed;
  z-index: 20;
  border: 1px solid var(--dsw-alias-state-business-primary, #315efb);
  background: rgba(49, 94, 251, .14);
  pointer-events: none;
  user-select: none;
}
.dsh-cos-storage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 8px 10px;
  align-content: start;
  min-height: 100%;
  touch-action: none;
}
.dsh-cos-storage-item {
  position: relative;
  display: flex;
  min-width: 0;
  height: 126px;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 15px 10px 10px;
  border: 1px solid transparent;
  border-radius: 3px;
  outline: none;
  background: transparent;
  cursor: default;
  transition: border-color .12s ease, background .12s ease;
  user-select: none;
}
.dsh-cos-storage-item:hover,
.dsh-cos-storage-item:focus-visible,
.dsh-cos-storage-item.is-selected {
  border-color: rgba(73, 114, 218, .42);
  box-shadow: none;
  transform: none;
}
.dsh-cos-storage-item:hover { background: rgba(255, 255, 255, .72); }
.dsh-cos-storage-item.is-selected { background: rgba(75, 118, 230, .09); }
.dsh-cos-storage-item__select {
  position: absolute;
  top: 9px;
  left: 9px;
  z-index: 2;
  width: 19px;
  height: 19px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2, #cbd1da);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base, #fff);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  line-height: 17px;
  opacity: 0;
}
.dsh-cos-storage-item:hover .dsh-cos-storage-item__select,
.dsh-cos-storage-item:focus-within .dsh-cos-storage-item__select,
.dsh-cos-storage-item__select[aria-pressed='true'] { opacity: 1; }
.dsh-cos-storage-item__select[aria-pressed='true'] {
  border-color: var(--dsw-alias-state-business-primary, #315efb);
  background: var(--dsw-alias-state-business-primary, #315efb);
}
.dsh-cos-storage-item__icon {
  width: 58px;
  height: 58px;
  flex: none;
}
.dsh-cos-storage-item__icon svg {
  display: block;
  width: 100%;
  height: 100%;
}
.dsh-cos-storage-item__name {
  width: 100%;
  margin-top: 8px;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #17191c);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-storage-item__meta {
  width: 100%;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-storage-grid.is-list {
  --dsh-cos-list-columns: 34px minmax(140px, 260px) minmax(0, 1fr) 112px 84px 150px 32px;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: var(--dsw-alias-bg-base, #fff);
}
.dsh-cos-storage-list-header {
  position: relative;
  display: grid;
  grid-template-columns: var(--dsh-cos-list-columns);
  gap: 12px;
  min-height: 38px;
  align-items: center;
  padding: 0 12px 0 46px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
  background: var(--dsw-alias-bg-layer-2, #f7f8fa);
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 11px;
}
.dsh-cos-storage-list-header span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-cos-storage-list-header span:nth-child(3) { text-align: left; }
.dsh-cos-storage-list-header span:nth-child(5),
.dsh-cos-storage-list-header span:nth-child(6),
.dsh-cos-storage-list-header span:nth-child(7) { text-align: right; }
.dsh-cos-storage-list-select-all {
  position: absolute;
  top: 50%;
  left: 14px;
  width: 19px;
  height: 19px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2, #cbd1da);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base, #fff);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  line-height: 17px;
  transform: translateY(-50%);
}
.dsh-cos-storage-list-select-all[aria-pressed='true'],
.dsh-cos-storage-list-select-all[data-indeterminate='true'] {
  border-color: var(--dsw-alias-state-business-primary, #315efb);
  background: var(--dsw-alias-state-business-primary, #315efb);
}
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item {
  display: grid;
  grid-template-columns: var(--dsh-cos-list-columns);
  gap: 12px;
  width: 100%;
  height: 58px;
  align-items: center;
  justify-content: initial;
  padding: 0 12px 0 46px;
  border: 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #edf0f3);
  border-radius: 0;
  box-shadow: none;
  transform: none;
}
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item:last-child { border-bottom: 0; }
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item:hover,
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item:focus-visible,
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item.is-selected {
  border-color: var(--dsw-alias-border-l2, #edf0f3);
  box-shadow: none;
  transform: none;
}
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item:hover { background: var(--dsw-alias-interactive-bg-hover, #f6f8fb); }
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item.is-selected { background: rgba(49, 94, 251, .07); }
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__select {
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
}
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__icon { width: 34px; height: 34px; }
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__name {
  margin: 0;
  color: var(--dsw-alias-label-primary, #17191c);
  text-align: left;
}
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__name.is-interactive {
  width: fit-content;
  max-width: 100%;
  justify-self: start;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
  text-overflow: ellipsis;
}
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__name.is-interactive:hover {
  color: var(--dsw-alias-state-business-primary, #315efb);
  text-decoration: underline;
}
.dsh-cos-storage-item__spacer,
.dsh-cos-storage-item__storage,
.dsh-cos-storage-item__size,
.dsh-cos-storage-item__modified { display: none; }
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__spacer { display: block; min-width: 0; min-height: 1px; }
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__meta { display: none; }
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__storage,
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__size,
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__modified {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary, #626a76);
  font-size: 12px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__more {
  position: static;
  grid-column: 7;
  grid-row: 1;
  opacity: 1;
}
.dsh-cos-storage-grid.is-list .dsh-cos-storage-item__menu { top: 48px; right: 8px; }
.dsh-cos-storage-item__more {
  position: absolute;
  top: 7px;
  right: 7px;
  z-index: 2;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #626a76);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  opacity: 0;
}
.dsh-cos-storage-item:hover .dsh-cos-storage-item__more,
.dsh-cos-storage-item:focus-within .dsh-cos-storage-item__more,
.dsh-cos-storage-item__more[aria-expanded='true'] {
  opacity: 1;
}
.dsh-cos-storage-item__more:hover {
  background: var(--dsw-alias-interactive-bg-hover, #eef1f5);
}
.dsh-cos-storage-item__menu {
  position: absolute;
  top: 36px;
  right: 7px;
  z-index: 5;
  min-width: 136px;
  padding: 5px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe3e8);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base, #fff);
  box-shadow: 0 8px 24px rgba(20, 28, 40, .14);
}
.dsh-cos-storage-item__menu button {
  width: 100%;
  min-height: 30px;
  padding: 0 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #17191c);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
}
.dsh-cos-storage-item__menu button:hover {
  background: var(--dsw-alias-interactive-bg-hover, #f1f3f6);
}
.dsh-cos-storage-item__menu button.is-danger { color: #c23b3b; }
.dsh-cos-storage-item__menu button:disabled { cursor: not-allowed; opacity: .5; }
.dsh-cos-storage-state {
  display: flex;
  min-height: 100%;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--dsw-alias-label-secondary, #626a76);
  text-align: center;
}
.dsh-cos-storage-state strong {
  margin-top: 12px;
  color: var(--dsw-alias-label-primary, #17191c);
  font-size: 15px;
}
.dsh-cos-storage-state p {
  max-width: 520px;
  margin: 7px 0 16px;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 13px;
  line-height: 1.6;
}
.dsh-cos-storage-spinner {
  width: 26px;
  height: 26px;
  border: 3px solid rgba(49, 94, 251, .18);
  border-top-color: var(--dsw-alias-state-business-primary, #315efb);
  border-radius: 50%;
  animation: dsh-cos-spin .75s linear infinite;
}
@keyframes dsh-cos-spin { to { transform: rotate(360deg); } }
.dsh-cos-storage-state__icon,
.dsh-cos-storage-empty-icon {
  display: inline-flex;
  width: 46px;
  height: 46px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(49, 94, 251, .1);
  color: var(--dsw-alias-state-business-primary, #315efb);
}
.dsh-cos-storage-state__icon {
  background: rgba(225, 58, 58, .1);
  color: #c43a3a;
  font-size: 22px;
  font-weight: 700;
}
.dsh-cos-storage-empty-icon svg { width: 24px; height: 24px; }
.dsh-cos-storage-pagination {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  padding: 0 24px;
  border-top: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 12px;
}
.dsh-cos-storage-pagination > div { display: flex; gap: 8px; }
.dsh-cos-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 26px;
  background: rgba(0, 0, 0, .48);
}
.dsh-cos-preview {
  position: relative;
  display: flex;
  width: min(1180px, 100%);
  height: min(800px, calc(100vh - 52px));
  flex-direction: column;
  color: #fff;
}
.dsh-cos-preview__title {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.dsh-cos-preview__body {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.dsh-cos-preview__state { display: flex; min-height: 100%; align-items: center; justify-content: center; padding: 28px; color: #737986; font-size: 13px; text-align: center; }
.dsh-cos-preview__state.is-error { color: #bf4242; background: #fff7f7; }
.dsh-cos-preview__ci-unavailable {
  box-sizing: border-box;
  width: min(520px, calc(100% - 64px));
  padding: 32px 36px 34px;
  border: 1px solid #e6e8eb;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 12px 36px rgba(0, 0, 0, .18);
  color: #4d5563;
  text-align: center;
}
.dsh-cos-preview__ci-unavailable > span {
  display: inline-flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border: 1px solid #d7dde8;
  border-radius: 50%;
  color: #6f7d91;
  font-size: 24px;
  font-weight: 300;
}
.dsh-cos-preview__ci-unavailable h3 { margin: 18px 0 10px; color: #252b36; font-size: 17px; font-weight: 400; }
.dsh-cos-preview__ci-unavailable p { margin: 0; color: #737b88; font-size: 13px; line-height: 1.75; text-align: left; }
.dsh-cos-preview__image { display: block; max-width: calc(100% - 72px); max-height: calc(100% - 48px); object-fit: contain; }
.dsh-cos-preview__video { display: block; width: min(960px, calc(100% - 72px)); max-height: calc(100% - 48px); background: #111; }
.dsh-cos-preview__audio { width: min(560px, calc(100% - 72px)); }
.dsh-cos-preview__frame { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
.dsh-cos-preview__text { box-sizing: border-box; width: calc(100% - 112px); max-height: calc(100% - 48px); margin: 24px 56px; padding: 18px 20px; overflow: auto; background: #1b1b1b; color: #d7d16a; font: 14px/1.62 ui-monospace, SFMono-Regular, Consolas, monospace; tab-size: 2; white-space: pre-wrap; word-break: break-word; }
.dsh-cos-preview__close,
.dsh-cos-preview__nav {
  position: absolute;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, .5);
  color: #fff;
  cursor: pointer;
  line-height: 1;
  transition: background-color .15s ease, transform .15s ease;
}
.dsh-cos-preview__close { top: 14px; right: 14px; width: 44px; height: 44px; font-size: 30px; }
.dsh-cos-preview__nav { top: 50%; width: 54px; height: 54px; transform: translateY(-50%); font-size: 46px; font-family: Arial, sans-serif; font-weight: 200; }
.dsh-cos-preview__nav.is-previous { left: 16px; }
.dsh-cos-preview__nav.is-next { right: 16px; }
.dsh-cos-preview__close:hover,
.dsh-cos-preview__nav:hover:not(:disabled),
.dsh-cos-preview__close:focus-visible,
.dsh-cos-preview__nav:focus-visible { background: rgba(0, 0, 0, .78); outline: 2px solid rgba(255, 255, 255, .9); outline-offset: 2px; }
.dsh-cos-preview__nav:disabled { visibility: hidden; }
.dsh-cos-preview__footer {
  display: inline-flex;
  min-width: 0;
  max-width: min(720px, calc(100% - 120px));
  align-self: center;
  align-items: center;
  gap: 10px;
  margin: 0 auto 14px;
  padding: 7px 10px 7px 14px;
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 10px;
  background: rgba(39, 43, 50, .74);
  color: rgba(255, 255, 255, .88);
  box-shadow: 0 6px 18px rgba(0, 0, 0, .2);
  font-size: 12px;
  backdrop-filter: blur(8px);
}
.dsh-cos-preview__file-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-cos-preview__file-size { flex: none; color: rgba(255, 255, 255, .58); white-space: nowrap; }
.dsh-cos-preview__footer button { flex: none; min-height: 26px; padding: 0 9px; border: 0; border-radius: 6px; background: rgba(255, 255, 255, .12); color: #edf3ff; cursor: pointer; font: inherit; font-size: 12px; }
.dsh-cos-preview__footer button:hover { background: rgba(255, 255, 255, .22); color: #fff; }
.dsh-cos-detail-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 20, 28, .38);
  backdrop-filter: blur(2px);
}
.dsh-cos-detail-modal {
  width: min(560px, 100%);
  max-height: min(680px, calc(100vh - 48px));
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 16px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  box-shadow: 0 20px 60px rgba(12, 18, 28, .22);
}
.dsh-cos-detail-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 22px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
}
.dsh-cos-detail-icon { width: 44px; height: 44px; flex: none; }
.dsh-cos-detail-icon svg { width: 100%; height: 100%; }
.dsh-cos-detail-heading { flex: 1; min-width: 0; }
.dsh-cos-detail-heading h2 {
  margin: 0;
  overflow: hidden;
  font-size: 16px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-detail-heading span {
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 12px;
}
.dsh-cos-detail-close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #626a76);
  cursor: pointer;
  font-size: 24px;
}
.dsh-cos-detail-close:hover { background: var(--dsw-alias-interactive-bg-hover, #f1f3f6); }
.dsh-cos-detail-list { margin: 0; padding: 8px 22px; }
.dsh-cos-detail-list > div {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  gap: 18px;
  padding: 13px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #edf0f3);
}
.dsh-cos-detail-list > div:last-child { border-bottom: 0; }
.dsh-cos-detail-list dt {
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 12px;
}
.dsh-cos-detail-list dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-primary, #17191c);
  font-size: 12px;
  text-align: right;
}
.dsh-cos-detail-footer {
  display: flex;
  justify-content: flex-end;
  padding: 14px 22px 18px;
  border-top: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
}
.dsh-cos-detail-footer button {
  min-width: 84px;
  height: 34px;
  border: 1px solid var(--dsw-alias-state-business-primary, #315efb);
  border-radius: 8px;
  background: var(--dsw-alias-state-business-primary, #315efb);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}
.dsh-cos-storage-settings-card {
  list-style: none;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
}
.dsh-cos-storage-settings-card[data-open='true'] {
  border-color: var(--dsw-alias-label-dimmed, #c5c9d0);
  background: var(--dsw-alias-bg-layer-2, #fafafa);
}
.dsh-cos-storage-settings-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.dsh-cos-storage-settings-head-text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.dsh-cos-storage-settings-name {
  font-size: 15px;
  font-weight: 600;
}
.dsh-cos-storage-settings-description,
.dsh-cos-storage-settings-note {
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 13px;
  line-height: 1.5;
}
.dsh-cos-storage-settings-chevron {
  flex: none;
  transition: transform .16s ease;
}
.dsh-cos-storage-settings-card[data-open='true'] .dsh-cos-storage-settings-chevron {
  transform: rotate(180deg);
}
.dsh-cos-storage-settings-body {
  margin: 0 16px;
  padding: 16px 0;
  border-top: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
}
.dsh-cos-storage-settings-body h4 {
  margin: 0 0 4px;
  font-size: 14px;
}
.dsh-cos-storage-settings-note {
  margin: 0 0 14px;
}
.dsh-cos-storage-settings-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.dsh-cos-storage-settings-item {
  min-width: 0;
  padding: 12px;
  border-radius: 9px;
  background: var(--dsw-alias-bg-base, #fff);
}
.dsh-cos-storage-settings-item strong,
.dsh-cos-storage-settings-item span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-storage-settings-item strong {
  margin-bottom: 4px;
  font-size: 12px;
}
.dsh-cos-storage-settings-item span {
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 12px;
}
.dsh-cos-settings-card {
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
}
.dsh-cos-settings-card__summary {
  padding: 15px 16px;
}
.dsh-cos-settings-card__summary-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.dsh-cos-settings-card__summary strong {
  font-size: 15px;
  font-weight: 650;
}
.dsh-cos-settings-card__summary small {
  display: block;
  margin-top: 4px;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 13px;
}
.dsh-cos-settings-card__summary small a {
  margin-left: 6px;
  color: var(--dsw-alias-state-business-primary, #315efb);
  text-decoration: none;
}
.dsh-cos-settings-card__summary small a:hover,
.dsh-cos-settings-card__summary small a:focus-visible {
  text-decoration: underline;
}
.dsh-cos-settings-card__summary-trigger:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #315efb);
  outline-offset: 3px;
  border-radius: 4px;
}
.dsh-cos-settings-card__chevron {
  flex: none;
  font-size: 18px;
  transition: transform .16s ease;
}
.dsh-cos-settings-card__chevron.is-open { transform: rotate(180deg); }
.dsh-cos-settings-card__body {
  margin: 0 16px;
  padding: 16px 0;
  border-top: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
}
.dsh-cos-settings-card__section-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 650;
}
.dsh-cos-settings-card__credential-state {
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.55;
}
.dsh-cos-settings-card__credential-state.is-ready {
  background: rgba(22, 163, 74, .09);
  color: #15703a;
}
.dsh-cos-settings-card__credential-state.is-missing {
  background: rgba(217, 119, 6, .1);
  color: #955405;
}
.dsh-cos-settings-card__fields {
  display: flex;
  flex-direction: column;
}
.dsh-cos-settings-card__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  padding: 18px 0 20px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
}
.dsh-cos-settings-card__field:first-child { padding-top: 16px; }
.dsh-cos-settings-card__field > span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 650;
}
.dsh-cos-settings-card__field em,
.dsh-cos-settings-card__field i {
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 10px;
  font-style: normal;
  font-weight: 500;
}
.dsh-cos-settings-card__field em {
  background: rgba(225, 58, 58, .09);
  color: #c23131;
}
.dsh-cos-settings-card__field i {
  background: var(--dsw-alias-interactive-bg-hover, #f0f2f5);
  color: var(--dsw-alias-label-tertiary, #7a818c);
}
.dsh-cos-settings-card__field input {
  width: 100%;
  height: 44px;
  box-sizing: border-box;
  padding: 0 13px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  border-radius: 8px;
  outline: none;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  font: inherit;
  font-size: 13px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.dsh-cos-settings-card__field input:focus {
  border-color: var(--dsw-alias-state-business-primary, #315efb);
  box-shadow: 0 0 0 3px rgba(49, 94, 251, .12);
}
.dsh-cos-settings-card__field input:disabled {
  cursor: not-allowed;
  opacity: .62;
}
.dsh-cos-settings-card__field > small {
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 12px;
  line-height: 1.6;
}
.dsh-cos-settings-card__feedback {
  margin-top: 14px;
  padding: 9px 11px;
  border-radius: 7px;
  font-size: 12px;
  line-height: 1.5;
}
.dsh-cos-settings-card__feedback.is-success {
  background: rgba(22, 163, 74, .09);
  color: #15703a;
}
.dsh-cos-settings-card__feedback.is-error {
  background: rgba(225, 58, 58, .09);
  color: #b12b2b;
}
.dsh-cos-settings-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.dsh-cos-settings-card__actions button {
  min-width: 92px;
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}
.dsh-cos-settings-card__actions button:disabled {
  cursor: not-allowed;
  opacity: .6;
}
.dsh-cos-settings-card__actions .is-secondary {
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
}
.dsh-cos-settings-card__actions .is-primary {
  border: 1px solid var(--dsw-alias-state-business-primary, #315efb);
  background: var(--dsw-alias-state-business-primary, #315efb);
  color: #fff;
}
.dsh-cos-settings-backdrop {
  position: absolute;
  inset: 0;
  z-index: 1400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 20, 28, .42);
  backdrop-filter: blur(2px);
}
.dsh-cos-settings-modal {
  display: flex;
  width: min(720px, 100%);
  max-height: min(780px, calc(100% - 24px));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 14px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  box-shadow: 0 22px 70px rgba(12, 18, 28, .26);
}
.dsh-cos-settings-modal > header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
}
.dsh-cos-settings-modal > header h2 { margin: 0; font-size: 18px; }
.dsh-cos-settings-modal > header button {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #626a76);
  cursor: pointer;
  font-size: 24px;
}
.dsh-cos-settings-modal > header button:hover { background: var(--dsw-alias-interactive-bg-hover, #f1f3f6); }
.dsh-cos-settings-modal__body { min-height: 0; padding: 18px 22px 22px; overflow: auto; }
.dsh-cos-upload-backdrop {
  position: absolute;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 20, 28, .42);
  backdrop-filter: blur(2px);
}
.dsh-cos-upload-modal {
  display: flex;
  width: min(820px, 100%);
  max-height: min(720px, calc(100% - 24px));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 14px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  box-shadow: 0 22px 70px rgba(12, 18, 28, .26);
}
.dsh-cos-upload-modal > header,
.dsh-cos-upload-modal > footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
}
.dsh-cos-upload-modal > header h2 { margin: 0; font-size: 18px; }
.dsh-cos-upload-modal > header span { color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 11px; }
.dsh-cos-upload-modal > header button {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #626a76);
  cursor: pointer;
  font-size: 24px;
}
.dsh-cos-upload-modal__body {
  flex: 1;
  min-height: 0;
  padding: 22px 24px;
  overflow: auto;
}
.dsh-cos-upload-modal__buttons { display: flex; gap: 10px; margin-bottom: 16px; }
.dsh-cos-upload-modal > footer { align-items: center; }
.dsh-cos-upload-conflict-select { display: inline-flex; align-items: center; gap: 7px; color: var(--dsw-alias-label-secondary, #626a76); font-size: 12px; }
.dsh-cos-upload-conflict-select select { height: 30px; padding: 0 26px 0 9px; border: 1px solid var(--dsw-alias-border-l2, #dfe2e7); border-radius: 7px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #17191c); cursor: pointer; font: inherit; font-size: 12px; }
.dsh-cos-upload-modal__footer-actions { display: inline-flex; gap: 10px; }
.dsh-cos-upload-modal__buttons button,
.dsh-cos-upload-modal > footer button {
  min-width: 100px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}
.dsh-cos-upload-modal__buttons button.is-primary,
.dsh-cos-upload-modal > footer button.is-primary {
  border-color: var(--dsw-alias-state-business-primary, #315efb);
  background: var(--dsw-alias-state-business-primary, #315efb);
  color: #fff;
}
.dsh-cos-upload-modal button:disabled { cursor: not-allowed; opacity: .5; }
.dsh-cos-upload-dropzone {
  min-height: 310px;
  overflow: auto;
  border: 1px dashed var(--dsw-alias-border-l2, #ccd2dc);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2, #f8f9fb);
  transition: border-color .15s ease, background .15s ease;
}
.dsh-cos-upload-dropzone.is-dragging {
  border-color: var(--dsw-alias-state-business-primary, #315efb);
  background: rgba(49, 94, 251, .06);
}
.dsh-cos-upload-dropzone__empty {
  display: flex;
  min-height: 310px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 24px;
  text-align: center;
}
.dsh-cos-upload-dropzone__empty > span {
  display: inline-flex;
  width: 52px;
  height: 52px;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: rgba(49, 94, 251, .1);
  color: var(--dsw-alias-state-business-primary, #315efb);
  font-size: 30px;
  font-weight: 300;
}
.dsh-cos-upload-dropzone__empty strong { margin-top: 14px; font-size: 15px; }
.dsh-cos-upload-dropzone__empty p {
  max-width: 500px;
  margin: 8px 0 0;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 12px;
  line-height: 1.6;
}
.dsh-cos-upload-selection__head,
.dsh-cos-upload-selection__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 70px;
  align-items: center;
  gap: 16px;
  min-height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #e8ebef);
}
.dsh-cos-upload-selection__head {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: 44px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 11px;
}
.dsh-cos-upload-selection__row { background: var(--dsw-alias-bg-base, #fff); font-size: 12px; }
.dsh-cos-upload-selection__row > div {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}
.dsh-cos-upload-selection__row > div > span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-upload-selection__row small { flex: none; color: var(--dsw-alias-label-tertiary, #8b919c); }
.dsh-cos-upload-selection__icon { color: #6f8cff; font-size: 20px; }
.dsh-cos-upload-selection__row > button {
  width: 28px;
  height: 28px;
  justify-self: end;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  cursor: pointer;
  font-size: 18px;
}
.dsh-cos-upload-selection__row > button:hover { background: var(--dsw-alias-interactive-bg-hover, #eef1f5); }
.dsh-cos-upload-modal__error {
  margin-top: 12px;
  padding: 9px 11px;
  border-radius: 7px;
  background: rgba(225, 58, 58, .09);
  color: #b12b2b;
  font-size: 12px;
}
.dsh-cos-upload-modal > footer {
  justify-content: flex-start;
  gap: 10px;
  border-top: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
  border-bottom: 0;
}
.dsh-cos-upload-modal__footer-actions { margin-left: auto; }
.dsh-cos-storage-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
}
.dsh-cos-storage-task-button { position: relative; }
.dsh-cos-storage-task-button > span {
  display: inline-flex;
  min-width: 17px;
  height: 17px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--dsw-alias-state-business-primary, #315efb);
  color: #fff;
  font-size: 9px;
  line-height: 1;
}
.dsh-cos-storage-notice {
  position: absolute;
  z-index: 1100;
  top: 18px;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  max-width: min(560px, calc(100% - 40px));
  padding: 9px 12px 9px 14px;
  border: 1px solid rgba(0, 0, 0, .08);
  border-radius: 9px;
  box-shadow: 0 8px 24px rgba(15, 20, 28, .16);
  transform: translateX(-50%);
  white-space: pre-line;
  font-size: 12px;
  line-height: 1.5;
  animation: dsh-cos-storage-notice-in .18s ease-out;
}
.dsh-cos-storage-notice.is-success { background: #effaf2; color: #15703a; }
.dsh-cos-storage-notice.is-error { background: #fff3f3; color: #b12b2b; }
@keyframes dsh-cos-storage-notice-in { from { opacity: 0; transform: translate(-50%, -6px); } to { opacity: 1; transform: translateX(-50%); } }
.dsh-cos-storage-notice button {
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  font-size: 18px;
}
.dsh-cos-dialog-backdrop,
.dsh-cos-confirm-backdrop {
  position: absolute;
  inset: 0;
  z-index: 1250;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 20, 28, .34);
  backdrop-filter: blur(2px);
}
.dsh-cos-confirm-dialog,
.dsh-cos-folder-dialog {
  width: min(460px, 100%);
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 14px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  box-shadow: 0 20px 60px rgba(12, 18, 28, .22);
}
.dsh-cos-folder-dialog header,
.dsh-cos-folder-dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
}
.dsh-cos-folder-dialog header { border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb); }
.dsh-cos-folder-dialog footer {
  justify-content: flex-end;
  gap: 9px;
  border-top: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
}
.dsh-cos-folder-dialog h2 { margin: 0; font-size: 16px; }
.dsh-cos-folder-dialog header button {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #626a76);
  cursor: pointer;
  font-size: 22px;
}
.dsh-cos-folder-dialog__body { padding: 20px; }
.dsh-cos-folder-dialog__body label { display: flex; flex-direction: column; gap: 9px; }
.dsh-cos-folder-dialog__body label span { font-size: 13px; font-weight: 600; }
.dsh-cos-folder-dialog__body input {
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  border-radius: 8px;
  outline: none;
  background: var(--dsw-alias-bg-base, #fff);
  color: inherit;
  font: inherit;
  font-size: 13px;
}
.dsh-cos-folder-dialog__body input:focus {
  border-color: var(--dsw-alias-state-business-primary, #315efb);
  box-shadow: 0 0 0 3px rgba(49, 94, 251, .12);
}
.dsh-cos-folder-dialog__error {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 7px;
  background: rgba(225, 58, 58, .09);
  color: #b12b2b;
  font-size: 12px;
}
.dsh-cos-folder-dialog footer button {
  min-width: 78px;
  height: 34px;
  padding: 0 13px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base, #fff);
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}
.dsh-cos-folder-dialog footer button.is-primary {
  border-color: var(--dsw-alias-state-business-primary, #315efb);
  background: var(--dsw-alias-state-business-primary, #315efb);
  color: #fff;
}
.dsh-cos-folder-dialog button:disabled { cursor: not-allowed; opacity: .55; }
.dsh-cos-confirm-dialog { padding: 20px; }
.dsh-cos-confirm-dialog h2 { margin: 0; font-size: 16px; }
.dsh-cos-confirm-dialog p { margin: 12px 0 20px; color: var(--dsw-alias-label-secondary, #626a76); font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
.dsh-cos-confirm-dialog footer { display: flex; justify-content: flex-end; gap: 9px; }
.dsh-cos-confirm-dialog footer button { min-width: 78px; height: 34px; padding: 0 13px; border: 1px solid var(--dsw-alias-border-l2, #dfe2e7); border-radius: 8px; background: var(--dsw-alias-bg-base, #fff); color: inherit; cursor: pointer; font: inherit; font-size: 13px; }
.dsh-cos-confirm-dialog footer .is-primary { border-color: var(--dsw-alias-state-business-primary, #315efb); background: var(--dsw-alias-state-business-primary, #315efb); color: #fff; }
.dsh-cos-confirm-dialog footer .is-danger { border-color: #c83d3d; background: #c83d3d; color: #fff; }
.dsh-cos-download-dialog,
.dsh-cos-link-dialog {
  width: min(480px, 100%);
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 14px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  box-shadow: 0 20px 60px rgba(12, 18, 28, .22);
}
.dsh-cos-download-dialog header,
.dsh-cos-download-dialog footer,
.dsh-cos-link-dialog header,
.dsh-cos-link-dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 20px;
}
.dsh-cos-download-dialog header,
.dsh-cos-link-dialog header { border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb); }
.dsh-cos-download-dialog footer,
.dsh-cos-link-dialog footer {
  justify-content: flex-end;
  gap: 9px;
  border-top: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
}
.dsh-cos-download-dialog h2,
.dsh-cos-link-dialog h2 { margin: 0; font-size: 16px; }
.dsh-cos-download-dialog header p,
.dsh-cos-link-dialog header p {
  max-width: 340px;
  margin: 4px 0 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-download-dialog header button,
.dsh-cos-link-dialog header button {
  width: 30px;
  height: 30px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #626a76);
  cursor: pointer;
  font-size: 22px;
}
.dsh-cos-download-dialog__body,
.dsh-cos-link-dialog__body { padding: 20px; }
.dsh-cos-download-dialog__body > span,
.dsh-cos-link-dialog__body > label > span,
.dsh-cos-link-dialog__body legend {
  display: block;
  margin-bottom: 9px;
  font-size: 13px;
  font-weight: 600;
}
.dsh-cos-download-directory {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  border-radius: 8px;
}
.dsh-cos-download-directory strong {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-download-directory button,
.dsh-cos-download-dialog footer button,
.dsh-cos-link-dialog footer button {
  min-width: 78px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base, #fff);
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}
.dsh-cos-download-dialog footer button.is-primary,
.dsh-cos-link-dialog footer button.is-primary,
.dsh-cos-download-directory button {
  border-color: var(--dsw-alias-state-business-primary, #315efb);
  background: var(--dsw-alias-state-business-primary, #315efb);
  color: #fff;
}
.dsh-cos-download-dialog__body > small,
.dsh-cos-download-dialog__fallback {
  display: block;
  margin: 9px 0 0;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 12px;
  line-height: 1.55;
}
.dsh-cos-link-dialog__body > label { display: block; }
.dsh-cos-link-dialog select {
  width: 100%;
  height: 42px;
  padding: 0 11px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base, #fff);
  color: inherit;
  font: inherit;
  font-size: 13px;
}
.dsh-cos-link-dialog fieldset {
  min-width: 0;
  margin: 18px 0 0;
  padding: 0;
  border: 0;
}
.dsh-cos-link-dialog fieldset label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  font-size: 12px;
}
.dsh-cos-link-dialog fieldset small {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-download-dialog button:disabled,
.dsh-cos-link-dialog button:disabled,
.dsh-cos-link-dialog select:disabled { cursor: not-allowed; opacity: .55; }
.dsh-cos-task-drawer {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1400;
  display: flex;
  width: min(380px, calc(100vw - 32px));
  max-height: min(520px, calc(100vh - 40px));
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 12px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  box-shadow: 0 12px 36px rgba(12, 18, 28, .2);
}
.dsh-cos-storage-transfer-button {
  position: relative;
  min-width: 30px;
  min-height: 30px;
  padding: 0 6px;
}
.dsh-cos-storage-transfer-button svg { width: 15px; height: 15px; }
.dsh-cos-storage-transfer-button span {
  position: absolute;
  top: -5px;
  right: -5px;
  display: inline-flex;
  min-width: 15px;
  height: 15px;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  border-radius: 9px;
  background: var(--dsw-alias-state-business-primary, #315efb);
  color: #fff;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
}
.dsh-cos-task-drawer.is-collapsed { width: min(300px, calc(100vw - 32px)); max-height: none; }
.dsh-cos-task-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
}
.dsh-cos-task-drawer.is-collapsed .dsh-cos-task-header { border-bottom: 0; }
.dsh-cos-task-header h2 { margin: 0; font-size: 16px; }
.dsh-cos-task-header span { color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 11px; }
.dsh-cos-task-header__actions { display: inline-flex; align-items: center; gap: 2px; }
.dsh-cos-task-header button {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #626a76);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}
.dsh-cos-task-header button:hover,
.dsh-cos-task-header button:focus-visible { background: var(--dsw-alias-interactive-bg-hover, #eef1f5); outline: none; }
.dsh-cos-task-summary {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #edf0f3);
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 11px;
}
.dsh-cos-task-summary__bar { flex: 1; margin: 0; }
.dsh-cos-task-summary > div:first-child,
.dsh-cos-task-summary__stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.dsh-cos-task-summary > div:first-child span,
.dsh-cos-task-summary__stats { color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 10px; }
.dsh-cos-task-summary > div:first-child strong { font-size: 13px; }
.dsh-cos-task-summary__bar {
  height: 6px;
  margin: 0;
  overflow: hidden;
  border-radius: 3px;
  background: var(--dsw-alias-interactive-bg-hover, #e9edf2);
}
.dsh-cos-task-summary__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--dsw-alias-state-business-primary, #315efb);
  transition: width .2s ease;
}
.dsh-cos-task-actions {
  display: flex;
  flex: none;
  justify-content: flex-end;
  padding: 10px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #edf0f3);
}
.dsh-cos-task-actions button,
.dsh-cos-task-item__buttons button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  border-radius: 7px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-secondary, #626a76);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}
.dsh-cos-task-actions button:disabled,
.dsh-cos-task-item__buttons button:disabled { cursor: not-allowed; opacity: .45; }
.dsh-cos-task-action-error {
  flex: none;
  margin: 10px 16px 0;
  padding: 8px 10px;
  border-radius: 7px;
  background: rgba(225, 58, 58, .09);
  color: #b12b2b;
  font-size: 11px;
  line-height: 1.5;
}
.dsh-cos-task-list {
  flex: 1;
  min-height: 0;
  padding: 8px 10px 12px;
  overflow: auto;
  background: var(--dsw-alias-bg-layer-2, #f7f8fa);
}
.dsh-cos-task-empty {
  display: flex;
  min-height: 240px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}
.dsh-cos-task-empty strong { font-size: 14px; }
.dsh-cos-task-empty p {
  max-width: 260px;
  margin: 7px 0 0;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 12px;
  line-height: 1.55;
}
.dsh-cos-task-item {
  margin-bottom: 6px;
  padding: 9px 10px;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base, #fff);
}
.dsh-cos-task-item__top,
.dsh-cos-task-item__stats,
.dsh-cos-task-item__buttons {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.dsh-cos-task-item__top strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-task-item__top span { flex: none; color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 11px; }
.dsh-cos-task-item.is-completed .dsh-cos-task-item__top span { color: #168345; }
.dsh-cos-task-item.is-failed .dsh-cos-task-item__top span { color: #bd3434; }
.dsh-cos-task-item__path {
  margin-top: 5px;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-task-progress {
  height: 5px;
  margin-top: 11px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--dsw-alias-interactive-bg-hover, #e9edf2);
}
.dsh-cos-task-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--dsw-alias-state-business-primary, #315efb);
  transition: width .2s ease;
}
.dsh-cos-task-item.is-completed .dsh-cos-task-progress span { background: #22a75a; }
.dsh-cos-task-item.is-failed .dsh-cos-task-progress span { background: #d84c4c; }
.dsh-cos-task-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 5px;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 10px;
}
.dsh-cos-task-item__error,
.dsh-cos-task-item__hint {
  margin-top: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  background: rgba(225, 58, 58, .08);
  color: #b12b2b;
  font-size: 10px;
  line-height: 1.45;
}
.dsh-cos-task-item__hint {
  background: rgba(217, 119, 6, .08);
  color: #955405;
}
.dsh-cos-task-item__buttons { justify-content: flex-end; margin-top: 10px; }
.dsh-cos-conversation-attach {
  position: relative;
  display: inline-flex;
}
.dsh-cos-conversation-file-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.dsh-cos-conversation-attach__trigger {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #626a76);
  cursor: pointer;
}
.dsh-cos-conversation-attach__trigger:hover,
.dsh-cos-conversation-attach__trigger[aria-expanded='true'] { background: var(--dsw-alias-interactive-bg-hover, #eef1f5); color: var(--dsw-alias-state-business-primary, #315efb); }
.dsh-cos-conversation-attach__trigger svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.dsh-cos-conversation-attach__menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 1300;
  min-width: 178px;
  padding: 5px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe3e8);
  border-radius: 9px;
  background: var(--dsw-alias-bg-base, #fff);
  box-shadow: 0 8px 24px rgba(20, 28, 40, .16);
}
.dsh-cos-conversation-attach__menu button {
  width: 100%;
  min-height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #17191c);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
}
.dsh-cos-conversation-attach__menu button:hover { background: var(--dsw-alias-interactive-bg-hover, #f1f3f6); }
.dsh-cos-conversation-dock { display: flex; flex-wrap: wrap; gap: 7px; padding: 7px 0; }
.dsh-cos-conversation-dock {
  box-sizing: border-box;
  width: calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));
  max-width: calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));
  margin: 0 auto 6px;
  padding: 0 var(--dsh-composer-dock-inset);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: none;
}
.dsh-cos-conversation-card {
  position: relative;
  display: inline-flex;
  width: 88px;
  min-height: 106px;
  box-sizing: border-box;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 12px 8px 9px;
  border: 1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(127,127,127,.22));
  border-radius: 12px;
  background: var(--dsw-specific-input-major, var(--dsw-alias-surface-2, rgba(127,127,127,.08)));
  box-shadow: var(--dsw-shadow-lv1, 0 1px 2px rgba(0,0,0,.06));
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 11px;
}
.dsh-cos-conversation-card__icon {
  display: inline-flex;
  width: 54px;
  height: 58px;
  align-items: center;
  justify-content: center;
}
.dsh-cos-conversation-card__icon svg {
  display: block;
  width: 54px;
  height: 58px;
}
.dsh-cos-conversation-card__name {
  display: -webkit-box;
  width: 100%;
  overflow: hidden;
  font-size: 12px;
  line-height: 16px;
  text-align: center;
  word-break: break-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.dsh-cos-conversation-card__meta { flex: none; color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 10.5px; }
.dsh-cos-conversation-card button,
.dsh-cos-conversation-dock__error button { width: 20px; height: 20px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--dsw-alias-label-secondary, #626a76); cursor: pointer; font-size: 16px; }
.dsh-cos-conversation-card > button { position: absolute; top: 4px; right: 4px; }
.dsh-cos-conversation-card button:hover { background: rgba(194, 59, 59, .1); color: #c23b3b; }
.dsh-cos-conversation-dock__error { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; background: rgba(225, 58, 58, .09); color: #b12b2b; font-size: 11px; }
.dsh-cos-attachment-backdrop { position: fixed; inset: 0; z-index: 1500; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15, 20, 28, .35); backdrop-filter: blur(2px); }
.dsh-cos-attachment-picker { display: flex; width: min(760px, 100%); max-height: min(700px, calc(100vh - 48px)); flex-direction: column; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, #e1e4e8); border-radius: 14px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #17191c); box-shadow: 0 20px 60px rgba(12, 18, 28, .22); }
.dsh-cos-attachment-picker header,
.dsh-cos-attachment-picker footer { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; }
.dsh-cos-attachment-picker header { border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb); }
.dsh-cos-attachment-picker header h2 { margin: 0; font-size: 16px; }
.dsh-cos-attachment-picker header p { margin: 5px 0 0; color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 12px; }
.dsh-cos-attachment-picker header > button { width: 30px; height: 30px; padding: 0; border: 0; border-radius: 7px; background: transparent; cursor: pointer; font-size: 22px; }
.dsh-cos-attachment-toolbar { display: flex; flex: none; align-items: center; gap: 12px; min-height: 42px; padding: 0 20px; border-bottom: 1px solid var(--dsw-alias-border-l2, #edf0f3); font-size: 12px; }
.dsh-cos-attachment-breadcrumbs { display: flex; min-width: 0; flex: 1; align-items: center; overflow: hidden; white-space: nowrap; }
.dsh-cos-attachment-breadcrumbs button { min-width: 0; padding: 0; border: 0; background: transparent; color: var(--dsw-alias-state-business-primary, #315efb); cursor: pointer; font: inherit; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-cos-attachment-breadcrumbs button.is-current { color: var(--dsw-alias-label-tertiary, #8b919c); cursor: default; }
.dsh-cos-attachment-breadcrumbs button:not(:disabled):hover { text-decoration: underline; }
.dsh-cos-attachment-breadcrumbs__separator { flex: none; margin: 0 5px; color: var(--dsw-alias-label-tertiary, #8b919c); }
.dsh-cos-attachment-toolbar__actions { display: inline-flex; flex: none; align-items: center; gap: 7px; }
.dsh-cos-attachment-toolbar__actions button,
.dsh-cos-attachment-picker footer button { min-height: 30px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2, #dfe2e7); border-radius: 7px; background: var(--dsw-alias-bg-base, #fff); color: inherit; cursor: pointer; font: inherit; font-size: 11px; }
.dsh-cos-attachment-file-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.dsh-cos-attachment-folder-create { display: flex; flex: none; align-items: center; gap: 8px; min-height: 42px; padding: 0 20px; border-bottom: 1px solid var(--dsw-alias-border-l2, #edf0f3); background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.dsh-cos-attachment-folder-create input { width: 180px; height: 29px; box-sizing: border-box; padding: 0 9px; border: 1px solid var(--dsw-alias-border-l2, #dfe2e7); border-radius: 7px; background: var(--dsw-alias-bg-base, #fff); color: inherit; font: inherit; font-size: 11px; }
.dsh-cos-attachment-folder-create button { min-height: 29px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2, #dfe2e7); border-radius: 7px; background: var(--dsw-alias-bg-base, #fff); color: inherit; cursor: pointer; font: inherit; font-size: 11px; }
.dsh-cos-attachment-folder-create span,
.dsh-cos-attachment-upload-progress { overflow: hidden; color: var(--dsw-alias-state-business-primary, #315efb); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.dsh-cos-attachment-upload-progress { flex: none; min-height: 30px; padding: 7px 20px; border-bottom: 1px solid var(--dsw-alias-border-l2, #edf0f3); background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.dsh-cos-attachment-body { min-height: 280px; padding: 12px 20px; overflow: auto; background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.dsh-cos-attachment-list { display: flex; flex-direction: column; gap: 7px; }
.dsh-cos-attachment-item { display: grid; grid-template-columns: 30px minmax(0, 1fr) 110px; gap: 10px; width: 100%; min-height: 46px; align-items: center; padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l2, #e1e4e8); border-radius: 8px; background: var(--dsw-alias-bg-base, #fff); color: inherit; cursor: pointer; text-align: left; }
.dsh-cos-attachment-item:hover,
.dsh-cos-attachment-item.is-selected { border-color: rgba(49, 94, 251, .48); background: rgba(49, 94, 251, .045); }
.dsh-cos-attachment-item > svg { width: 28px; height: 28px; }
.dsh-cos-attachment-item__name { min-width: 0; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.dsh-cos-attachment-item__meta { color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 11px; text-align: right; }
.dsh-cos-attachment-state { display: flex; min-height: 260px; align-items: center; justify-content: center; color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 13px; }
.dsh-cos-attachment-error { padding: 9px 10px; border-radius: 7px; background: rgba(225, 58, 58, .09); color: #b12b2b; font-size: 12px; }
.dsh-cos-attachment-picker footer { border-top: 1px solid var(--dsw-alias-border-l2, #e6e8eb); }
.dsh-cos-attachment-picker footer > div { display: flex; gap: 8px; }
.dsh-cos-attachment-picker footer .is-primary { border-color: var(--dsw-alias-state-business-primary, #315efb); background: var(--dsw-alias-state-business-primary, #315efb); color: #fff; }
.dsh-cos-attachment-picker button:disabled { cursor: not-allowed; opacity: .5; }
.dsh-cos-local-upload {
  display: flex;
  width: min(760px, 100%);
  max-height: min(780px, calc(100vh - 48px));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, #e1e4e8);
  border-radius: 14px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #17191c);
  box-shadow: 0 20px 60px rgba(12, 18, 28, .22);
}
.dsh-cos-local-upload > header,
.dsh-cos-local-upload > footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}
.dsh-cos-local-upload > header { border-bottom: 1px solid var(--dsw-alias-border-l2, #e6e8eb); }
.dsh-cos-local-upload > header h2 { margin: 0; font-size: 16px; }
.dsh-cos-local-upload > header p { margin: 5px 0 0; color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 12px; }
.dsh-cos-local-upload > header > button {
  width: 30px;
  height: 30px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
}
.dsh-cos-local-upload__source,
.dsh-cos-local-upload__destination { min-height: 0; }
.dsh-cos-local-upload__source {
  display: flex;
  min-height: 270px;
  flex: 1 1 auto;
  flex-direction: column;
}
.dsh-cos-local-upload__destination {
  flex: none;
  border-top: 1px solid var(--dsw-alias-border-l2, #e6e8eb);
  background: var(--dsw-alias-bg-layer-2, #f7f8fa);
}
.dsh-cos-local-upload__section-title {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 20px;
}
.dsh-cos-local-upload__section-title h3 { margin: 0; font-size: 13px; }
.dsh-cos-local-upload__section-title span {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 11px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-local-upload__toolbar {
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 9px;
  padding: 0 20px;
  border-top: 1px solid var(--dsw-alias-border-l2, #edf0f3);
  border-bottom: 1px solid var(--dsw-alias-border-l2, #edf0f3);
  font-size: 11px;
}
.dsh-cos-local-upload__toolbar span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b919c);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-local-upload__toolbar button,
.dsh-cos-local-upload__toolbar select,
.dsh-cos-local-upload > footer button,
.dsh-cos-local-upload__conflicts button {
  min-height: 29px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  border-radius: 7px;
  background: var(--dsw-alias-bg-base, #fff);
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}
.dsh-cos-local-upload__toolbar select { max-width: 132px; }
.dsh-cos-local-upload__list {
  flex: 1;
  min-height: 160px;
  padding: 8px 20px;
  overflow: auto;
}
.dsh-cos-local-upload__entry {
  display: flex;
  min-height: 42px;
  align-items: center;
  margin: 2px 0;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 7px;
}
.dsh-cos-local-upload__entry:hover,
.dsh-cos-local-upload__entry.is-selected { border-color: rgba(49, 94, 251, .4); background: rgba(49, 94, 251, .05); }
.dsh-cos-local-upload__toggle {
  width: 19px;
  height: 19px;
  flex: none;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2, #cbd1da);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base, #fff);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  line-height: 17px;
}
.dsh-cos-local-upload__toggle[aria-pressed='true'] { border-color: var(--dsw-alias-state-business-primary, #315efb); background: var(--dsw-alias-state-business-primary, #315efb); }
.dsh-cos-local-upload__entry-main {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 90px;
  width: 100%;
  min-width: 0;
  min-height: 40px;
  align-items: center;
  gap: 9px;
  padding: 0 6px 0 9px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.dsh-cos-local-upload__entry-main svg { width: 26px; height: 26px; }
.dsh-cos-local-upload__entry-main span,
.dsh-cos-local-upload__entry-main small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cos-local-upload__entry-main span { font-size: 12px; }
.dsh-cos-local-upload__entry-main small { color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 11px; text-align: right; }
.dsh-cos-local-upload__destination-list {
  display: flex;
  min-height: 42px;
  max-height: 98px;
  align-items: center;
  gap: 7px;
  padding: 8px 20px;
  overflow-x: auto;
  overflow-y: hidden;
}
.dsh-cos-local-upload__destination-list > span { color: var(--dsw-alias-label-tertiary, #8b919c); font-size: 11px; }
.dsh-cos-local-upload__destination-list button {
  display: inline-flex;
  min-width: 110px;
  max-width: 190px;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 9px;
  border: 1px solid var(--dsw-alias-border-l2, #dfe2e7);
  border-radius: 7px;
  background: var(--dsw-alias-bg-base, #fff);
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  text-align: left;
}
.dsh-cos-local-upload__destination-list button:hover { border-color: rgba(49, 94, 251, .5); color: var(--dsw-alias-state-business-primary, #315efb); }
.dsh-cos-local-upload__destination-list svg { width: 24px; height: 24px; }
.dsh-cos-local-upload__destination-list button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-cos-local-upload__error,
.dsh-cos-local-upload__conflicts {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 20px 0;
  padding: 8px 10px;
  border-radius: 7px;
  background: rgba(225, 58, 58, .09);
  color: #b12b2b;
  font-size: 11px;
}
.dsh-cos-local-upload__conflicts { background: rgba(217, 119, 6, .1); color: #955405; }
.dsh-cos-local-upload__conflicts > span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-cos-local-upload__conflicts > div { display: flex; gap: 7px; }
.dsh-cos-local-upload > footer { margin-top: 10px; border-top: 1px solid var(--dsw-alias-border-l2, #e6e8eb); }
.dsh-cos-local-upload > footer label { display: inline-flex; align-items: center; gap: 7px; color: var(--dsw-alias-label-secondary, #626a76); font-size: 11px; }
.dsh-cos-local-upload > footer select { height: 29px; border: 1px solid var(--dsw-alias-border-l2, #dfe2e7); border-radius: 7px; background: var(--dsw-alias-bg-base, #fff); color: inherit; font: inherit; font-size: 11px; }
.dsh-cos-local-upload > footer > div { display: flex; gap: 8px; }
.dsh-cos-local-upload .is-primary { border-color: var(--dsw-alias-state-business-primary, #315efb); background: var(--dsw-alias-state-business-primary, #315efb); color: #fff; }
.dsh-cos-local-upload button:disabled,
.dsh-cos-local-upload select:disabled { cursor: not-allowed; opacity: .5; }
@keyframes dsh-cos-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes dsh-cos-dialog-in {
  from { opacity: 0; transform: translateY(10px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes dsh-cos-drawer-in {
  from { opacity: 0; transform: translateX(28px); }
  to { opacity: 1; transform: translateX(0); }
}
.dsh-cos-preview-backdrop,
.dsh-cos-detail-backdrop,
.dsh-cos-upload-backdrop,
.dsh-cos-dialog-backdrop,
.dsh-cos-task-backdrop,
.dsh-cos-attachment-backdrop { animation: dsh-cos-overlay-in 160ms ease-out both; }
.dsh-cos-preview,
.dsh-cos-detail-modal,
.dsh-cos-upload-modal,
.dsh-cos-folder-dialog,
.dsh-cos-download-dialog,
.dsh-cos-link-dialog,
.dsh-cos-attachment-picker,
.dsh-cos-local-upload { animation: dsh-cos-dialog-in 180ms cubic-bezier(.2, .8, .2, 1) both; }
.dsh-cos-task-drawer { animation: dsh-cos-drawer-in 190ms cubic-bezier(.2, .8, .2, 1) both; }
.dsh-cos-storage-item__menu { animation: dsh-cos-dialog-in 120ms ease-out both; transform-origin: top right; }

.dsh-cos-conversation-attach__trigger {
  width: auto;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #626a76);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  transition: background-color .15s ease;
}
.dsh-cos-conversation-attach__trigger:hover,
.dsh-cos-conversation-attach__trigger[aria-expanded='true'] { background: var(--dsw-alias-interactive-bg-hover, #eef1f5); color: var(--dsw-alias-label-secondary, #626a76); }
.dsh-cos-conversation-attach__trigger:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #315efb); outline-offset: 2px; }
.dsh-cos-conversation-attach__trigger svg,
.dsh-cos-conversation-attach__menu,
.dsh-cos-conversation-file-input { display: none; }

.dsh-cos-attachment-picker {
  width: min(920px, 100%);
  height: min(740px, calc(100vh - 48px));
  max-height: min(740px, calc(100vh - 48px));
  border-radius: 8px;
}
.dsh-cos-attachment-body {
  flex: 1;
  min-height: 0;
  padding: 0;
  background: var(--dsw-alias-bg-base, #fff);
}
.dsh-cos-attachment-list { --dsh-cos-attachment-columns: 22px 30px minmax(150px, 1fr) 104px 84px 146px; display: flex; flex-direction: column; gap: 0; min-width: 690px; }
.dsh-cos-attachment-list__header,
.dsh-cos-attachment-item {
  display: grid;
  grid-template-columns: var(--dsh-cos-attachment-columns);
  align-items: center;
  column-gap: 12px;
  min-height: 48px;
  padding: 0 18px;
  border: 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #edf0f3);
  border-radius: 0;
}
.dsh-cos-attachment-list__header {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: 38px;
  background: var(--dsw-alias-bg-layer-2, #f7f8fa);
  color: var(--dsw-alias-label-tertiary, #8b919c);
  font-size: 11px;
}
.dsh-cos-attachment-list__header > span:nth-child(3) { text-align: left; }
.dsh-cos-attachment-list__header > span:nth-child(n + 4) { text-align: right; }
.dsh-cos-attachment-list__select-all,
.dsh-cos-attachment-item__select {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2, #cbd1da);
  border-radius: 3px;
  background: var(--dsw-alias-bg-base, #fff);
  color: #fff;
  cursor: pointer;
  font-size: 11px;
  line-height: 14px;
}
.dsh-cos-attachment-list__select-all[aria-pressed='true'],
.dsh-cos-attachment-list__select-all[data-indeterminate='true'],
.dsh-cos-attachment-item__select[aria-pressed='true'] { border-color: var(--dsw-alias-state-business-primary, #315efb); background: var(--dsw-alias-state-business-primary, #315efb); }
.dsh-cos-attachment-item { width: auto; color: var(--dsw-alias-label-primary, #17191c); cursor: pointer; }
.dsh-cos-attachment-item.is-folder { cursor: default; }
.dsh-cos-attachment-item:hover { background: var(--dsw-alias-interactive-bg-hover, #f6f8fb); }
.dsh-cos-attachment-item__select.is-placeholder { display: block; border-color: transparent; background: transparent; cursor: default; }
.dsh-cos-attachment-item.is-selected { border-color: var(--dsw-alias-border-l2, #edf0f3); background: rgba(49, 94, 251, .07); }
.dsh-cos-attachment-item__icon { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; }
.dsh-cos-attachment-item__icon svg { width: 27px; height: 27px; }
.dsh-cos-attachment-item__name,
.dsh-cos-attachment-item__storage,
.dsh-cos-attachment-item__size,
.dsh-cos-attachment-item__modified { min-width: 0; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.dsh-cos-attachment-item__name { padding: 0; border: 0; background: transparent; color: inherit; text-align: left; }
.dsh-cos-attachment-item__name.is-folder { width: fit-content; max-width: 100%; cursor: pointer; }
.dsh-cos-attachment-item__name.is-folder:hover { color: var(--dsw-alias-state-business-primary, #315efb); text-decoration: underline; }
.dsh-cos-attachment-item__storage,
.dsh-cos-attachment-item__size,
.dsh-cos-attachment-item__modified { color: var(--dsw-alias-label-secondary, #626a76); text-align: right; }

@media (prefers-reduced-motion: reduce) {
  .dsh-cos-preview-backdrop,
  .dsh-cos-detail-backdrop,
  .dsh-cos-upload-backdrop,
  .dsh-cos-dialog-backdrop,
  .dsh-cos-task-backdrop,
  .dsh-cos-attachment-backdrop,
  .dsh-cos-preview,
  .dsh-cos-detail-modal,
  .dsh-cos-upload-modal,
  .dsh-cos-folder-dialog,
  .dsh-cos-download-dialog,
  .dsh-cos-link-dialog,
  .dsh-cos-attachment-picker,
  .dsh-cos-local-upload,
  .dsh-cos-task-drawer,
  .dsh-cos-storage-item__menu { animation: none; }
}

@media (max-width: 720px) {
  .dsh-cos-attachment-picker { width: 100%; }
  .dsh-cos-attachment-list { min-width: 620px; }
  .dsh-cos-storage-settings-preview { grid-template-columns: 1fr; }
  .dsh-cos-storage-page-header { padding: 0 16px; }
  .dsh-cos-storage-page-body { padding: 20px; }
  .dsh-cos-storage-toolbar {
    align-items: flex-start;
    padding: 10px 16px;
  }
  .dsh-cos-storage-toolbar__group { flex-wrap: wrap; }
  .dsh-cos-storage-toolbar button { padding: 0 9px; }
  .dsh-cos-storage-breadcrumb { padding: 0 16px; }
  .dsh-cos-storage-root-prefix { display: none; }
  .dsh-cos-storage-content { padding: 16px; }
  .dsh-cos-storage-grid { grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 10px; }
  .dsh-cos-storage-pagination { padding: 0 16px; }
  .dsh-cos-detail-list > div { grid-template-columns: 1fr; gap: 5px; }
  .dsh-cos-detail-list dd { text-align: left; }
  .dsh-cos-settings-card__actions { flex-direction: column-reverse; }
  .dsh-cos-settings-card__actions button { width: 100%; }
}
`

export function installStyles(): () => void {
  const existing = document.getElementById(STYLE_ID)
  if (existing !== null) return () => {}
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.dataset.plugin = PACKAGE_ID
  style.textContent = CSS
  document.head.appendChild(style)
  return () => { style.remove() }
}
