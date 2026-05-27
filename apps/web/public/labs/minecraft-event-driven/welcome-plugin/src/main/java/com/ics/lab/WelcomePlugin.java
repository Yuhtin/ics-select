package com.ics.lab;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;

public class WelcomePlugin extends JavaPlugin implements Listener {

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("Welcome plugin enabled");
    }

    @EventHandler(priority = EventPriority.NORMAL)
    public void onJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        getLogger().info("[Welcome] " + p.getName() + " entrou. Mandando saudação.");
        p.sendMessage("§e§lBem-vindo, " + p.getName() + "!");
        p.sendMessage("§7Esse plugin é o Welcome. Estou registrado no PlayerJoinEvent.");
    }
}
