package com.ics.lab;

import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Arrays;

/**
 * /sudo <player> <command...>
 *   Roda o comando como se o player tivesse digitado no chat.
 *   Pra WorldEdit funcionar com `//`, precisa rolar via Player.chat()
 *   que dispara AsyncChatEvent (intercept point do WE).
 */
public class SudoPlugin extends JavaPlugin {

    @Override
    public boolean onCommand(CommandSender s, Command cmd, String label, String[] args) {
        if (args.length < 2) {
            s.sendMessage("Uso: /sudo <player> <command...>");
            return true;
        }
        Player p = Bukkit.getPlayer(args[0]);
        if (p == null) {
            s.sendMessage("Player não encontrado: " + args[0]);
            return true;
        }
        String command = String.join(" ", Arrays.copyOfRange(args, 1, args.length));

        // performCommand aceita a string com leading `/`. WorldEdit registra
        // comandos com o `//` literal no nome (`//paste`, `//schem`), então
        // mantemos o input intacto. Se não começar com /, adicionamos pra
        // funcionar como comando padrão.
        String toDispatch = command.startsWith("/") ? command : "/" + command;
        boolean ok = p.performCommand(toDispatch.startsWith("/") ? toDispatch.substring(1) : toDispatch);
        s.sendMessage(Component.text("Sudo: " + p.getName() + " → " + toDispatch + " (ok=" + ok + ")"));
        return true;
    }
}
