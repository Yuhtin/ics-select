package com.ics.lab;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.time.Instant;
import java.util.UUID;

public class AnalyticsPlugin extends JavaPlugin implements Listener {

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("Analytics plugin enabled");
    }

    /**
     * MONITOR priority: observa o estado final do evento.
     * Convenção: nunca modifica, só registra.
     */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        String eventId = UUID.randomUUID().toString().substring(0, 8);
        getLogger().info(
            "[Analytics] " + p.getName() + " entrou em "
            + Instant.now() + ". event_id=" + eventId
        );

        // numa app real isso seria um produce em Kafka ou um POST num webhook
        // (async, fora do main thread — ver beat 5)
    }
}
