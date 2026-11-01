package dev.eldershi.dysoncompat.mixin;

import dev.eldershi.dysoncompat.client.NativeControllerRegistry;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(value = BlockEntity.class, remap = false)
public abstract class BlockEntityLifecycleMixin {
    @Inject(method = "m_6339_()V", at = @At("RETURN"), remap = false)
    private void createStyleDyson$registerGlobalRenderer(CallbackInfo result) {
        NativeControllerRegistry.register((BlockEntity) (Object) this);
    }

    @Inject(method = {"m_7651_()V", "onChunkUnloaded()V"}, at = @At("HEAD"), remap = false)
    private void createStyleDyson$removeGlobalRenderer(CallbackInfo result) {
        NativeControllerRegistry.unregister((BlockEntity) (Object) this);
    }
}
