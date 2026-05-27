package com.ics.lab;

import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * ChatPlugin — formato simples: [ICS] player » message
 *
 * Usa o renderer do AsyncChatEvent ao invés de cancelar + broadcast.
 * Vantagens:
 *   • Performance — Paper aplica o render lazy por viewer
 *   • Mantém compatibilidade com outros plugins de chat
 *   • Histórico/signed chat continua funcionando
 */
public class ChatPlugin extends JavaPlugin implements Listener {

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("ChatPlugin enabled · formato: [ICS] <player> » <message>");
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onChat(AsyncChatEvent e) {
        e.renderer((source, sourceDisplayName, message, viewer) ->
            Component.text()
                .append(Component.text("[", NamedTextColor.DARK_GRAY))
                .append(Component.text("ICS", NamedTextColor.YELLOW, TextDecoration.BOLD))
                .append(Component.text("] ", NamedTextColor.DARK_GRAY))
                .append(sourceDisplayName.colorIfAbsent(NamedTextColor.YELLOW))
                .append(Component.text(" » ", NamedTextColor.GRAY))
                .append(message.colorIfAbsent(NamedTextColor.WHITE))
                .build()
        );
    }
}
