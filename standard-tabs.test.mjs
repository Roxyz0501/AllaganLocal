import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('canonical trailing tabs remain last and ordered Settings, Language, Support',async()=>{
 const source=await readFile(new URL('./StandardPluginTabs.cs',import.meta.url),'utf8');
 const canonical=await readFile(new URL('../templates/Dalamud/StandardPluginTabs.cs',import.meta.url),'utf8');
 assert.equal(source.replaceAll('\r\n','\n'),canonical.replaceAll('\r\n','\n'));
 const method=source.slice(source.indexOf('public static void DrawStandardTrailingTabs('),source.indexOf('public static string? DrawLanguageSelector'));
 assert.deepEqual([...method.matchAll(/ImGui.BeginTabItem\(\$"([^"\n]*)"\)/g)].map(m=>m[1]),['{settingsLabel}###{settingsStableId}','{languageSettingsLabel}###LanguageSettings','{supportLabel}###Support']);
 const plugin=await readFile(new URL('./Plugin.cs',import.meta.url),'utf8');
 assert.equal((plugin.match(/StandardPluginTabs.DrawStandardTrailingTabs\(/g)||[]).length,1);
 assert(!plugin.includes('ImGui.BeginTabItem('),'all tabs must use canonical trailing group');
 assert.match(plugin,/DrawStandardTrailingTabs\(\s*T\("ui\.7"\),"settings",DrawSettings,\s*T\("language-tab"\),DrawLanguageSettings,\s*T\("ui\.12"\),DrawSupport\);\s*ImGui.EndTabBar\(\)/);
 assert(!plugin.slice(plugin.indexOf('private void DrawSettings'),plugin.indexOf('private void DrawLanguageSettings')).includes('DrawLanguageSelector'));
});
