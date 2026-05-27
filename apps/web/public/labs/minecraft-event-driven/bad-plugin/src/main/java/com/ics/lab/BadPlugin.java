package com.ics.lab;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * O plugin "ruim" — demonstra a pegadinha do Beat 5.
 *
 * Faz Thread.sleep(2000) no main thread durante o PlayerJoinEvent.
 * Resultado: o tick inteiro pausa por 2 segundos. TPS despenca pra 0.
 * Os outros listeners (Welcome, Scoreboard, Analytics) ficam ESPERANDO
 * porque o servidor é serial no main thread.
 *
 * Demonstra ao vivo no terminal:
 *   /tps      (antes: 20.0)
 *   <player joins>
 *   /tps      (durante: TPS caindo)
 *
 * NÃO CARREGAR EM PRODUÇÃO. É didático.
 */
public class BadPlugin extends JavaPlugin implements Listener {

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().warning("BAD plugin enabled — bloqueia o main thread no join");
    }

    @EventHandler(priority = EventPriority.LOW)
    public void onJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        getLogger().warning("[BAD] " + p.getName() + " entrou. Vou bloquear o main thread...");
        try {
            // PEGADINHA: I/O bloqueante no main thread.
            // numa app real isso seria httpClient.send(...) ou jdbc.query(...).
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        getLogger().warning("[BAD] " + p.getName() + " desbloqueado. Servidor de volta.");
    }
}
