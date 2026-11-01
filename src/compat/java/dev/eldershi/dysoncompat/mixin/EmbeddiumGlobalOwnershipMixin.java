package dev.eldershi.dysoncompat.mixin;

import dev.eldershi.dysoncompat.client.NativeControllerRegistry;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Pseudo;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Pseudo
@Mixin(targets = "me.jellysquid.mods.sodium.client.render.chunk.data.BuiltSectionInfo$Builder", remap = false)
public abstract class EmbeddiumGlobalOwnershipMixin {
    @Inject(method = "addBlockEntity(Lnet/minecraft/world/level/block/entity/BlockEntity;Z)V", at = @At("HEAD"), cancellable = true, remap = false)
    private void createStyleDyson$nativeGlobalOwner(BlockEntity entity, boolean culled, CallbackInfo result) {
        if (NativeControllerRegistry.skipSectionOwnership(entity)) result.cancel();
    }
}
