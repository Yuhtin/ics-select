package com.ics.lab;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.Scoreboard;

public class ScoreboardPlugin extends JavaPlugin implements Listener {

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("Scoreboard plugin enabled");
    }

    @EventHandler(priority = EventPriority.NORMAL)
    public void onJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        getLogger().info("[Scoreboard] " + p.getName() + " entrou. Adicionando ao scoreboard.");

        Scoreboard board = Bukkit.getScoreboardManager().getNewScoreboard();
        Objective obj = board.registerNewObjective("ics", "dummy", "§a§lICS Lab");
        obj.setDisplaySlot(DisplaySlot.SIDEBAR);
        obj.getScore("§7Player: §f" + p.getName()).setScore(3);
        obj.getScore("§7Plugins ativos: §f3").setScore(2);
        obj.getScore("§7Listener priority: §fNORMAL").setScore(1);

        p.setScoreboard(board);
    }
}
