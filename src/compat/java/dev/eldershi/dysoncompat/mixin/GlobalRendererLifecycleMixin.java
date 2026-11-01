package dev.eldershi.dysoncompat.mixin;

import dev.eldershi.dysoncompat.client.NativeControllerRegistry;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.renderer.LevelRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(value = LevelRenderer.class, remap = false)
public abstract class GlobalRendererLifecycleMixin {
    @Shadow private ClientLevel f_109465_;

    @Inject(method = "m_109818_()V", at = @At("RETURN"), remap = false)
    private void createStyleDyson$restoreGlobals(CallbackInfo result) {
        NativeControllerRegistry.rebind((LevelRenderer) (Object) this, f_109465_);
    }

    @Inject(method = "m_109701_(Lnet/minecraft/client/multiplayer/ClientLevel;)V", at = @At("RETURN"), remap = false)
    private void createStyleDyson$changeWorld(ClientLevel world, CallbackInfo result) {
        NativeControllerRegistry.rebind((LevelRenderer) (Object) this, world);
    }
}
